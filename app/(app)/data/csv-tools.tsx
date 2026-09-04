"use client";

import { useActionState } from "react";
import { CheckCircle2, Download, FileUp, PackagePlus, XCircle } from "lucide-react";
import {
  importItemsCsvAction,
  importReceiptsCsvAction,
  type CsvImportState,
  type ImportRowResult,
} from "@/lib/actions/csv";

const initialState: CsvImportState = { results: [] };
const fileClass =
  "block min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700";

function Results({ state }: { state: CsvImportState }) {
  if (!state.message && !state.error && state.results.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      {state.message || state.error ? (
        <p className={`rounded-md border px-3 py-2 text-sm ${state.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {state.error ?? state.message}
        </p>
      ) : null}
      {state.results.length ? (
        <div className="max-h-72 overflow-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-3 py-2 font-semibold">Row</th><th className="px-3 py-2 font-semibold">Reference</th><th className="px-3 py-2 font-semibold">Result</th></tr></thead>
            <tbody className="divide-y divide-slate-200 bg-white">{state.results.map((result: ImportRowResult) => <tr key={`${result.row}-${result.reference}`}><td className="px-3 py-2 text-slate-500">{result.row}</td><td className="px-3 py-2 font-medium text-slate-800">{result.reference}</td><td className="px-3 py-2"><span className={`inline-flex items-center gap-1.5 ${result.success ? "text-emerald-700" : "text-red-700"}`}>{result.success ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}{result.reason}</span></td></tr>)}</tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function ImportButton({ pending, label }: { pending: boolean; label: string }) {
  return <button type="submit" disabled={pending} className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"><FileUp className="h-4 w-4" aria-hidden="true" />{pending ? "Importing..." : label}</button>;
}

export function CsvTools() {
  const [itemState, itemAction, itemPending] = useActionState<CsvImportState, FormData>(importItemsCsvAction, initialState);
  const [receiptState, receiptAction, receiptPending] = useActionState<CsvImportState, FormData>(importReceiptsCsvAction, initialState);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <form action={itemAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Item import</h2></div><a href="data:text/csv;charset=utf-8,sku%2Cname%2Cdescription%2CunitOfMeasure%2CreorderLevel%2Ccategory%0A" download="item-import-template.csv" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" aria-hidden="true" />Template</a></div>
        <label className="mt-4 block text-sm font-medium text-slate-700">CSV file<input name="file" type="file" accept=".csv,text/csv" required className={`mt-1 ${fileClass}`} /></label>
        <div className="mt-4"><ImportButton pending={itemPending} label="Import items" /></div>
        <Results state={itemState} />
      </form>

      <form action={receiptAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><FileUp className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Receipt import</h2></div><a href="data:text/csv;charset=utf-8,sku%2Cquantity%2Clocation%2Creason%0A" download="receipt-import-template.csv" className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4" aria-hidden="true" />Template</a></div>
        <label className="mt-4 block text-sm font-medium text-slate-700">CSV file<input name="file" type="file" accept=".csv,text/csv" required className={`mt-1 ${fileClass}`} /></label>
        <div className="mt-4"><ImportButton pending={receiptPending} label="Import receipts" /></div>
        <Results state={receiptState} />
      </form>
    </div>
  );
}
