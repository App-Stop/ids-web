import Modal from './Modal'

/**
 * Read-only job summary, opened from the board's job cell. Shows the job name
 * and nothing else — there is nothing to edit here.
 */
export default function JobInfoModal({
  jobName,
  onClose,
}: {
  jobName: string
  onClose: () => void
}) {
  return (
    <Modal onClose={onClose} width={420}>
      <h2 className="modal-title sb-jobinfo__title">{jobName}</h2>

      <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
        <button type="button" className="btn btn--primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
