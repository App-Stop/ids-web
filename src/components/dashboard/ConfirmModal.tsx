import Modal from './Modal'
import { Icon } from './icons'
import warning from '../../assets/Warning.png'

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal onClose={onCancel} width={320}>
      <div className="confirm-modal">
        <img src={warning}/>
        <h2 className="confirm-modal__title">{title}</h2>
        <p className="confirm-modal__message">{message}</p>
      </div>

      <div className="modal-actions modal-actions--center">
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--danger-solid" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
