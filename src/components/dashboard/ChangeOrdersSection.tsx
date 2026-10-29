import { useState } from 'react'
import { Icon } from './icons'
import { getJobChangeOrders, type ChangeOrder, type JobChangeOrders } from '../../api/jobApi'
import { useChangeOrderMutations } from '../../hooks/useQueryHooks'
import { parseApiErrors } from '../../lib/errors'
import { dollars, signedDollars } from '../../lib/changeOrders'
import './change-orders.css'

/** The contract figures a job carries; the CO endpoints return the same set. */
export type ContractSummary = Pick<
  JobChangeOrders,
  'contractAmount' | 'changeOrderTotal' | 'pendingChangeOrderTotal' | 'revisedContractAmount' | 'changeOrders'
>

function shortDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type Sign = 1 | -1

/** What the inline form is doing: adding a CO, or editing the one with this id. */
type FormTarget = { mode: 'create' } | { mode: 'edit'; co: ChangeOrder }

/** A one-way or destructive action waiting on an inline confirm. */
type Pending = { kind: 'approve' | 'delete'; co: ChangeOrder } | null

export default function ChangeOrdersSection({
  jobId,
  summary,
  onChange,
}: {
  jobId: string
  summary: ContractSummary
  /** Called with the fresh totals and list from every successful write. */
  onChange: (next: ContractSummary) => void
}) {
  const { createChangeOrderMutation, updateChangeOrderMutation, deleteChangeOrderMutation } =
    useChangeOrderMutations()

  const [form, setForm] = useState<FormTarget | null>(null)
  const [sign, setSign] = useState<Sign>(1)
  const [amountDraft, setAmountDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [approveNow, setApproveNow] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [confirming, setConfirming] = useState<Pending>(null)
  const [rowError, setRowError] = useState('')
  const [busy, setBusy] = useState(false)

  const revised = summary.revisedContractAmount ?? summary.contractAmount
  const changeOrders = summary.changeOrders

  function openForm(target: FormTarget) {
    setForm(target)
    setConfirming(null)
    setRowError('')
    setFieldErrors({})
    setFormError('')
    if (target.mode === 'edit') {
      setSign(target.co.amount < 0 ? -1 : 1)
      setAmountDraft(String(Math.abs(target.co.amount)))
      setNoteDraft(target.co.note ?? '')
    } else {
      setSign(1)
      setAmountDraft('')
      setNoteDraft('')
    }
    setApproveNow(false)
  }

  function applyResponse(data: JobChangeOrders) {
    onChange({
      contractAmount: data.contractAmount,
      changeOrderTotal: data.changeOrderTotal,
      pendingChangeOrderTotal: data.pendingChangeOrderTotal,
      revisedContractAmount: data.revisedContractAmount,
      changeOrders: data.changeOrders,
    })
  }

  /** On a 404 the CO (or job) is gone — pull the list again so the UI stops offering it. */
  async function handleError(err: unknown, fallback: string, report: (msg: string) => void) {
    const status = (err as { response?: { status?: number } })?.response?.status
    if (status === 404) {
      report('This change order (or job) no longer exists.')
      try {
        const res = await getJobChangeOrders(jobId)
        if (res.data) applyResponse(res.data)
      } catch {
        // The job itself is gone; the message above already says so.
      }
      return
    }
    const parsed = parseApiErrors(err, fallback)
    setFieldErrors(parsed.fieldErrors)
    report(parsed.generalMessage)
  }

  const magnitude = amountDraft === '' ? NaN : Number(amountDraft)
  const amountValue = Number.isFinite(magnitude) ? sign * magnitude : NaN

  // Live preview of the revised total, only when saving would actually apply
  // the CO: an approved one being edited, or one approved as it is saved. Only
  // an already-approved CO's old amount is in the total to take back out.
  const editingApproved = form?.mode === 'edit' && form.co.status === 'approved'
  const applies = editingApproved || approveNow
  const previewRevised =
    applies && Number.isFinite(amountValue)
      ? revised - (editingApproved && form?.mode === 'edit' ? form.co.amount : 0) + amountValue
      : null

  async function submitForm() {
    if (!form) return
    setFieldErrors({})
    setFormError('')
    if (!Number.isFinite(amountValue) || amountValue === 0) {
      setFieldErrors({ amount: 'Enter an amount other than 0' })
      return
    }
    const note = noteDraft.trim()
    setBusy(true)
    try {
      const res =
        form.mode === 'create'
          ? await createChangeOrderMutation.mutateAsync({
              jobId,
              payload: {
                amount: amountValue,
                ...(note ? { note } : {}),
                ...(approveNow ? { status: 'approved' as const } : {}),
              },
            })
          : await updateChangeOrderMutation.mutateAsync({
              jobId,
              changeOrderId: form.co._id,
              payload: {
                amount: amountValue,
                note,
                ...(approveNow && form.co.status === 'pending' ? { status: 'approved' as const } : {}),
              },
            })
      applyResponse(res.data)
      setForm(null)
    } catch (err) {
      await handleError(err, 'Failed to save the change order.', setFormError)
    } finally {
      setBusy(false)
    }
  }

  async function runConfirmed() {
    if (!confirming) return
    const { kind, co } = confirming
    setRowError('')
    setBusy(true)
    try {
      const res =
        kind === 'approve'
          ? await updateChangeOrderMutation.mutateAsync({
              jobId,
              changeOrderId: co._id,
              payload: { status: 'approved' },
            })
          : await deleteChangeOrderMutation.mutateAsync({ jobId, changeOrderId: co._id })
      applyResponse(res.data)
      setConfirming(null)
    } catch (err) {
      setConfirming(null)
      await handleError(
        err,
        kind === 'approve' ? 'Failed to approve the change order.' : 'Failed to delete the change order.',
        setRowError,
      )
    } finally {
      setBusy(false)
    }
  }

  const formView = form && (
    <div className="co-form">
      <div className="co-form__title">
        {form.mode === 'create' ? 'New change order' : `Edit CO${form.co.number}`}
      </div>

      <label className="field-label">Amount</label>
      <div className="co-form__amount">
        <div className="co-sign" role="group" aria-label="Add to or deduct from the contract">
          <button
            type="button"
            className={`co-sign__btn${sign === 1 ? ' is-active is-add' : ''}`}
            onClick={() => setSign(1)}
          >
            + Add
          </button>
          <button
            type="button"
            className={`co-sign__btn${sign === -1 ? ' is-active is-deduct' : ''}`}
            onClick={() => setSign(-1)}
          >
            − Deduct
          </button>
        </div>
        <div className={`field-money co-form__money${fieldErrors.amount ? ' field-money--error' : ''}`}>
          <span>$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amountDraft}
            autoFocus
            onChange={(e) => setAmountDraft(e.target.value.replace('-', ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitForm()
            }}
          />
        </div>
      </div>
      {fieldErrors.amount && <span className="field-error-text">{fieldErrors.amount}</span>}

      <label className="field-label co-form__label">
        Note <span className="co-optional">(Optional)</span>
      </label>
      <textarea
        className={`field-textarea${fieldErrors.note ? ' field-input--error' : ''}`}
        placeholder="What changed in the scope..."
        value={noteDraft}
        onChange={(e) => setNoteDraft(e.target.value)}
      />
      {fieldErrors.note && <span className="field-error-text">{fieldErrors.note}</span>}

      {!editingApproved && (
        <label className="co-check">
          <input type="checkbox" checked={approveNow} onChange={(e) => setApproveNow(e.target.checked)} />
          Approve now
          <span className="co-check__hint">Applies it to the contract and revenue from today. Can't be undone.</span>
        </label>
      )}

      <p className="co-preview">
        {previewRevised !== null ? (
          <>
            Revised contract after saving: <strong>{dollars(previewRevised)}</strong>
            {previewRevised < 1 && <span className="co-preview__warn"> — must stay above $0</span>}
          </>
        ) : applies ? (
          'Enter an amount to preview the revised contract.'
        ) : (
          "Saved as pending — the contract won't change until it's approved."
        )}
      </p>

      {formError && <p className="field-error co-error">{formError}</p>}

      <div className="modal-actions co-form__actions">
        <button type="button" className="btn btn--outline btn--sm" disabled={busy} onClick={() => setForm(null)}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary btn--sm" disabled={busy} onClick={submitForm}>
          {busy ? 'Saving...' : form.mode === 'create' ? 'Add Change Order' : 'Save Changes'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="co-section">
      <div className="note-section__head">
        <span className="field-label co-section__title">
          Change Orders
          {changeOrders.length > 0 && <span className="co-count">{changeOrders.length}</span>}
        </span>
        {!form && (
          <button type="button" className="note-section__action" onClick={() => openForm({ mode: 'create' })}>
            + Add Change Order
          </button>
        )}
      </div>

      {form?.mode === 'create' && formView}

      {changeOrders.length === 0 && !form ? (
        <p className="crew-row__empty">No change orders yet</p>
      ) : (
        changeOrders.length > 0 && (
          <div className="co-ledger">
            <div className="co-ledger__row co-ledger__row--base">
              <span className="co-ledger__label">Original contract</span>
              <span className="co-ledger__amount">{dollars(summary.contractAmount)}</span>
            </div>

            {changeOrders.map((co) => {
              const isPending = co.status === 'pending'
              const isEditing = form?.mode === 'edit' && form.co._id === co._id
              const isConfirming = confirming?.co._id === co._id
              return (
                <div key={co._id} className={`co-item${isPending ? ' is-pending' : ''}`}>
                  <div className="co-ledger__row">
                    <span className="co-ledger__label">
                      <strong className="co-num">CO{co.number}</strong>
                      <span className={`co-badge co-badge--${co.status}`}>
                        {isPending ? 'Pending' : 'Approved'}
                      </span>
                      {!isPending && co.approvedAt && (
                        <span className="co-meta">{shortDate(co.approvedAt)}</span>
                      )}
                    </span>
                    <span
                      className={`co-ledger__amount ${co.amount < 0 ? 'is-neg' : 'is-pos'}`}
                      title={isPending ? 'Pending — not counted in the contract yet' : undefined}
                    >
                      {isPending ? `(${signedDollars(co.amount)})` : signedDollars(co.amount)}
                    </span>
                    {!isEditing && !isConfirming && (
                      <span className="co-actions">
                        {isPending && (
                          <button
                            type="button"
                            className="co-action co-action--approve"
                            title="Approve"
                            onClick={() => {
                              setRowError('')
                              setConfirming({ kind: 'approve', co })
                            }}
                          >
                            <Icon.Check width={14} height={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="co-action"
                          title="Edit"
                          onClick={() => openForm({ mode: 'edit', co })}
                        >
                          <Icon.Edit width={14} height={14} />
                        </button>
                        <button
                          type="button"
                          className="co-action co-action--delete"
                          title="Delete"
                          onClick={() => {
                            setRowError('')
                            setConfirming({ kind: 'delete', co })
                          }}
                        >
                          <Icon.Trash width={14} height={14} />
                        </button>
                      </span>
                    )}
                  </div>
                  {co.note && !isEditing && <p className="co-note">{co.note}</p>}

                  {isConfirming && confirming && (
                    <div className={`co-confirm co-confirm--${confirming.kind}`}>
                      <span>
                        {confirming.kind === 'approve'
                          ? `Approve CO${co.number}? ${signedDollars(co.amount)} is applied to the contract from today, and approval can't be undone.`
                          : `Delete CO${co.number}? Later change orders will be renumbered.`}
                      </span>
                      <span className="co-confirm__btns">
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          disabled={busy}
                          onClick={() => setConfirming(null)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className={`btn btn--sm ${confirming.kind === 'approve' ? 'btn--primary' : 'btn--danger'}`}
                          disabled={busy}
                          onClick={runConfirmed}
                        >
                          {busy ? 'Working...' : confirming.kind === 'approve' ? 'Approve' : 'Delete'}
                        </button>
                      </span>
                    </div>
                  )}

                  {isEditing && formView}
                </div>
              )
            })}

            <div className="co-ledger__row co-ledger__row--total">
              <span className="co-ledger__label">Net change</span>
              <span className="co-ledger__amount">{signedDollars(summary.changeOrderTotal)}</span>
            </div>
            <div className="co-ledger__row co-ledger__row--total co-ledger__row--revised">
              <span className="co-ledger__label">Revised contract</span>
              <span className="co-ledger__amount">{dollars(revised)}</span>
            </div>
            {summary.pendingChangeOrderTotal !== 0 && (
              <div className="co-ledger__row co-ledger__row--pending">
                <span className="co-ledger__label">Pending (not counted)</span>
                <span className="co-ledger__amount">{signedDollars(summary.pendingChangeOrderTotal)}</span>
              </div>
            )}
          </div>
        )
      )}

      {rowError && <p className="field-error co-error">{rowError}</p>}
    </div>
  )
}
