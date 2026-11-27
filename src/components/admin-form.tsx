'use client';

import { useActionState } from 'react';
import type { Field, FormState, Option } from '@/lib/admin/entities';

const input = 'w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 outline-none focus:border-[var(--accent)]';
const initial: FormState = { ok: false, message: null };

export function AdminForm({
  action,
  fields,
  values,
  options,
  submitLabel,
}: {
  action: (previous: FormState, form: FormData) => Promise<FormState>;
  fields: Field[];
  values: Record<string, string | boolean>;
  options: Record<string, Option[]>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initial);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2" noValidate>
      {fields.map((field) => {
        const id = `f-${field.name}`;
        const value = values[field.name];
        const wide = field.type === 'textarea' || field.type === 'url';
        const label = (
          <span className="mb-1 block text-sm text-zinc-300">
            {field.label}
            {field.required && <span className="text-[var(--accent)]"> *</span>}
          </span>
        );
        let control: React.ReactNode;
        if (field.type === 'checkbox') {
          control = (
            <label className="flex items-center gap-3 pt-6 text-sm">
              <input type="hidden" name={field.name} value="off" />
              <input type="checkbox" name={field.name} value="on" defaultChecked={Boolean(value)} className="h-4 w-4 accent-[var(--accent)]" />
              {field.label}
            </label>
          );
        } else if (field.type === 'textarea') {
          control = <textarea id={id} name={field.name} rows={4} defaultValue={String(value ?? '')} className={input} />;
        } else if (field.type === 'select' || field.type === 'relation') {
          const list = field.type === 'select' ? (field.options ?? []) : (options[field.name] ?? []);
          control = (
            <select id={id} name={field.name} defaultValue={String(value ?? '')} className={input}>
              {!field.required && field.type !== 'select' && <option value="">— Aucun —</option>}
              {field.required && field.type === 'relation' && <option value="">Choisir…</option>}
              {list.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          );
        } else {
          const type = field.type === 'datetime' ? 'datetime-local' : field.type === 'number' || field.type === 'integer' ? 'number' : 'text';
          control = (
            <input
              id={id}
              name={field.name}
              type={type}
              step={field.type === 'number' ? 'any' : field.type === 'integer' ? 1 : undefined}
              min={field.min}
              max={field.type === 'number' || field.type === 'integer' ? field.max : undefined}
              defaultValue={String(value ?? '')}
              className={input}
            />
          );
        }
        return (
          <div key={field.name} className={wide ? 'sm:col-span-2' : ''}>
            {field.type === 'checkbox' ? control : <label htmlFor={id}>{label}{control}</label>}
            {field.help && <p className="mt-1 text-xs text-zinc-500">{field.help}</p>}
            {errors[field.name] && <p role="alert" className="mt-1 text-xs text-red-300">{errors[field.name]}</p>}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-[var(--accent)] px-5 py-2 font-medium hover:brightness-110 disabled:opacity-60">
          {pending ? 'Enregistrement…' : submitLabel}
        </button>
        {state.message && <span role={state.ok ? 'status' : 'alert'} className={`text-sm ${state.ok ? 'text-emerald-300' : 'text-red-300'}`}>{state.message}</span>}
      </div>
    </form>
  );
}
