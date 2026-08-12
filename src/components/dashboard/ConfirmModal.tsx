import Modal from './Modal'
import warning from '../../assets/Warning.png'
import { Icon } from './icons'

export default function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmBtnClass = 'btn--danger-solid',
  iconType = 'warning',
  onCancel,
  onConfirm,
}: {
  title: string
  message: string
  confirmLabel: string
  confirmBtnClass?: string
  iconType?: 'warning' | 'question'
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal onClose={onCancel} width={320}>
      <div className="confirm-modal">
        {iconType === 'question' ? (
          <div style={{ margin: '0 auto 1rem auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', color: '#16a34a' }}>
            <Icon.QuestionCircle width={28} height={28} />
          </div>
        ) : (
          <img src={warning}/>
        )}
        <h2 className="confirm-modal__title">{title}</h2>
        <p className="confirm-modal__message">{message}</p>
      </div>

      <div className="modal-actions modal-actions--center">
        <button type="button" className="btn btn--outline" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className={`btn ${confirmBtnClass}`} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
