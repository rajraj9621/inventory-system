"use server";

import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db, withDatabaseRetry } from "@/lib/db";
import { clearSessionCookie, createSessionToken, setSessionCookie } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(1, "Enter your password."),
});

const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().email("Enter a valid email address.").transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters."),
  confirmPassword: z.string().min(1, "Confirm your password."),
  role: z.enum(["STAFF", "MANAGER"]),
  managerId: z.string().optional(),
}).superRefine((data, context) => {
  if (data.password !== data.confirmPassword) {
    context.addIssue({
      code: "custom",
      message: "Passwords do not match.",
      path: ["confirmPassword"],
    });
  }

  if (data.role === "STAFF" && !data.managerId) {
    context.addIssue({
      code: "custom",
      message: "Choose your manager.",
      path: ["managerId"],
    });
  }
});

export type LoginFormState = {
  error?: string;
  email?: string;
};

export type RegisterFormState = {
  error?: string;
  name?: string;
  email?: string;
  role?: "STAFF" | "MANAGER";
  managerId?: string;
};

export async function loginAction(
  _previousState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check your login details.",
      email: String(formData.get("email") ?? ""),
    };
  }

  let user;

  try {
    user = await withDatabaseRetry(() =>
      db.user.findUnique({
        where: { email: parsed.data.email },
      }),
    );
  } catch {
    return {
      error: "The database is temporarily unavailable. Try signing in again.",
      email: parsed.data.email,
    };
  }

  if (!user?.active) {
    return {
      error: "Invalid email or password.",
      email: parsed.data.email,
    };
  }

  const passwordIsValid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordIsValid) {
    return {
      error: "Invalid email or password.",
      email: parsed.data.email,
    };
  }

  const token = await createSessionToken(user);
  await setSessionCookie(token);

  redirect("/dashboard");
}

export async function registerAction(
  _previousState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const fallbackState: RegisterFormState = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    role: formData.get("role") === "MANAGER" ? "MANAGER" : "STAFF",
    managerId: String(formData.get("managerId") ?? ""),
  };

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    role: formData.get("role"),
    managerId: String(formData.get("managerId") ?? "") || undefined,
  });

  if (!parsed.success) {
    return {
      ...fallbackState,
      error: parsed.error.issues[0]?.message ?? "Check your registration details.",
    };
  }

  try {
    const role = parsed.data.role === "MANAGER" ? UserRole.MANAGER : UserRole.STAFF;
    let managerId: string | null = null;

    if (role === UserRole.STAFF) {
      const manager = await withDatabaseRetry(() =>
        db.user.findFirst({
          where: {
            id: parsed.data.managerId,
            role: UserRole.MANAGER,
            active: true,
          },
          select: { id: true },
        }),
      );

      if (!manager) {
        return {
          ...fallbackState,
          error: "Choose an active manager.",
        };
      }

      managerId = manager.id;
    }

    await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash: await hashPassword(parsed.data.password),
        role,
        managerId,
      },
    });

    await clearSessionCookie();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return {
        ...fallbackState,
        error: "An account already exists for this email.",
      };
    }

    return {
      ...fallbackState,
      error: "Could not create account. Try again.",
    };
  }

  redirect("/login?registered=1");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
