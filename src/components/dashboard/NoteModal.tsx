import { useState } from 'react'
import Modal from './Modal'
import ConfirmModal from './ConfirmModal'

type Mode = 'add' | 'view' | 'edit'

export default function NoteModal({
  note,
  jobName,
  jobNo,
  date,
  onCancel,
  onSave,
  onDelete,
}: {
  note: string | null
  jobName?: string
  jobNo?: string | number
  date?: string
  onCancel: () => void
  onSave: (text: string) => void
  onDelete: () => void
}) {
  const [mode, setMode] = useState<Mode>(note ? 'view' : 'add')
  const [text, setText] = useState(note ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  if (confirmingDelete) {
    return (
      <ConfirmModal
        title="Are you sure you want to delete this note?"
        message="This action is irreversible."
        confirmLabel="Yes Delete"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={onDelete}
      />
    )
  }

  if (mode === 'view' && note) {
    return (
      <Modal onClose={onCancel} width={400}>
        <h2 className="modal-title">Job Note</h2>
        {jobNo && <p className="job-head__meta" style={{ marginTop: '0.15rem' }}>Job #{jobNo}{date ? ` · ${date}` : ''}</p>}
        {jobName && <p className="assign-crew__job-name">{jobName}</p>}
        <p className="note-view-text" style={{ marginTop: '1rem', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{note}</p>
        <div className="modal-actions modal-actions--split" style={{ marginTop: '1.25rem' }}>
          <button type="button" className="btn btn--danger" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
          <div className="modal-actions__group">
            <button type="button" className="btn btn--outline" onClick={() => setMode('edit')}>
              Edit
            </button>
            <button type="button" className="btn btn--primary" onClick={onCancel}>
              Done
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  const isEdit = mode === 'edit'

  return (
    <Modal onClose={onCancel} width={400}>
      <h2 className="modal-title">{isEdit ? 'Edit Note' : 'Add Note'}</h2>
      {jobNo && <p className="job-head__meta" style={{ marginTop: '0.15rem' }}>Job #{jobNo}{date ? ` · ${date}` : ''}</p>}
      {jobName && <p className="assign-crew__job-name">{jobName}</p>}
      <textarea
        className={`field-textarea ${isEdit ? '' : 'field-textarea--tall'}`}
        style={{ marginTop: '1rem', background: 'var(--field-bg)' }}
        placeholder="Type your note for this date..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="modal-actions" style={{ marginTop: '1.25rem' }}>
        <button type="button" className="btn btn--outline" disabled={saving} onClick={() => (isEdit ? setMode('view') : onCancel())}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!text.trim() || saving}
          onClick={async () => {
            setSaving(true)
            await onSave(text.trim())
            setSaving(false)
          }}
        >
          {saving ? 'Saving...' : isEdit ? 'Update Note' : 'Save Note'}
        </button>
      </div>
    </Modal>
  )
}
