import { useNavigate } from 'react-router-dom'
import heroImg from '../../assets/image.png'
import { CREW_LOGIN_PATH } from '../../components/ProtectedRoute'
import './crew-auth.css'

/** Crew entry screen — hero photo over the tagline, leading into sign in. */
export default function CrewGetStarted() {
  const navigate = useNavigate()

  return (
    <div className="cauth cauth-start">
      <div className="cauth-start__hero">
        <img src={heroImg} alt="" />
      </div>

      <div className="cauth-start__content">
        <h1 className="cauth-start__headline">
          Your partners for high-quality Concrete Cutting and Selective and
          Complete Demolition in Atlanta, Georgia.
        </h1>

        <button
          className="cauth-submit"
          type="button"
          onClick={() => navigate(CREW_LOGIN_PATH)}
        >
          Get Started
        </button>
      </div>
    </div>
  )
}
