import { useState } from 'react'
import Modal from './Modal'

type Mode = 'add' | 'view' | 'edit'

export default function NoteModal({
  note,
  onCancel,
  onSave,
  onDelete,
}: {
  note: string | null
  onCancel: () => void
  onSave: (text: string) => void
  onDelete: () => void
}) {
  const [mode, setMode] = useState<Mode>(note ? 'view' : 'add')
  const [text, setText] = useState(note ?? '')

  if (mode === 'view' && note) {
    return (
      <Modal onClose={onCancel} width={380}>
        <h2 className="modal-title">Note</h2>
        <p className="note-view-text">{note}</p>
        <div className="modal-actions modal-actions--split">
          <button type="button" className="btn btn--danger" onClick={onDelete}>
            Delete
          </button>
          <div className="modal-actions">
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
    <Modal onClose={onCancel} width={380}>
      <h2 className="modal-title">{isEdit ? 'Edit Note' : 'Add Note'}</h2>
      {!isEdit && <label className="field-label">Add a note</label>}
      <textarea
        className={`field-textarea ${isEdit ? '' : 'field-textarea--tall'}`}
        style={isEdit ? { marginTop: '1.1rem', background: 'var(--field-bg)' } : undefined}
        placeholder="Note about the job..."
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus
      />
      <div className="modal-actions">
        <button type="button" className="btn btn--outline" onClick={() => (isEdit ? setMode('view') : onCancel())}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={!text.trim()}
          onClick={() => onSave(text.trim())}
        >
          {isEdit ? 'Update' : 'Add'}
        </button>
      </div>
    </Modal>
  )
}
