import { useEffect, useRef, useState } from "react";
import { SignOut, User } from "@phosphor-icons/react";
import Sidebar from "../components/dashboard/Sidebar";
import { Icon } from "../components/dashboard/icons";
import "./Dashboard.css";
import "./Profile.css";
import { useAuth } from "../context/AuthContext";
import api from "../api/axiosInstance";
import { changeAdminPassword } from "../api/crewApi";
import { parseApiErrors } from "../lib/errors";
import PasswordInput from "../components/PasswordInput";

interface ProfileData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profilePicture: string;
  isActive: boolean;
}

export default function Profile() {
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [profileData, setProfileData] = useState<ProfileData | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { logout } = useAuth();

  useEffect(() => {
    const getProfileData = async () => {
      try {
        const data = await api.get<any>("/admin/me");
        const res = data.data
        const profData: ProfileData = {
          id: res.data._id || "",
          firstName: res.data.firstName || res.data.fullName?.split(" ")[0] || "",
          lastName: res.data.lastName || res.data.fullName?.split(" ").slice(1).join(" ") || "",
          email: res.data.email || "",
          role: res.data.role || "",
          profilePicture: res.data.profilePicture?.location || "",
          isActive: res.data.isActive ?? true,
        };
        setProfileData(profData);
      } catch (err: any) {
        console.error("Failed to fetch profile:", err);
      }
    };

    getProfileData()
  }, []);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!currentPassword) {
      setPasswordError("Please enter your current password.");
      return;
    }
    if (!newPassword) {
      setPasswordError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changeAdminPassword({
        currentPassword,
        newPassword,
        confirmNewPassword: confirmPassword,
      });
      setPasswordSuccess("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      if (err.response?.status === 401) {
        setPasswordError("Incorrect current password.");
      } else {
        const parsed = parseApiErrors(err, "Failed to update password. Please try again.");
        setPasswordError(parsed.generalMessage);
      }
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="dash profile-page">
      <Sidebar active="Profile" />

      <main className="dash__main profile-page__main">
        <div className="profile-page__header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="dash__title profile-page__title">Profile</h1>
            <p className="dash__subtitle">
              Manage your account settings and preferences
            </p>
          </div>
          <button
            type="button"
            className="profile-logout"
            onClick={() => logout()}
          >
            <SignOut size={16} weight="regular" />
            Log Out
          </button>
        </div>

        <section className="profile-card profile-card--settings">
          <div className="profile-photo-row">
            <div className="profile-photo">
              {profileData?.profilePicture ? (
                <img
                  src={profileData?.profilePicture}
                  alt="Profile"
                  className="profile-photo__img"
                />
              ) : (
                <User size={44} weight="thin" />
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="profile-photo-input"
            />
            <button
              type="button"
              className="btn profile-upload-btn"
              onClick={() => photoInputRef.current?.click()}
            >
              Upload Photo
            </button>
          </div>

          <div className="profile-grid">
            <label className="profile-field">
              <span>First Name</span>
              <input defaultValue={profileData?.firstName} key={`fn_${profileData?.firstName}`} />
            </label>
            <label className="profile-field">
              <span>Last Name</span>
              <input defaultValue={profileData?.lastName} key={`ln_${profileData?.lastName}`} />
            </label>
            <label className="profile-field profile-field--full">
              <span>Email</span>
              <input defaultValue={profileData?.email} key={`em_${profileData?.email}`} readOnly style={{ background: '#f8fafc', cursor: 'not-allowed' }} />
            </label>
          </div>

          <hr className="profile-divider" style={{ margin: "2rem 0" }} />

          <h2 style={{ fontSize: "1.1rem", fontWeight: 700, marginBottom: "1.25rem", color: "var(--ink)" }}>
            Change Password
          </h2>

          <form onSubmit={handleChangePassword}>
            {passwordError && (
              <div style={{ padding: "0.6rem 0.9rem", background: "#fef2f2", color: "#ef4444", borderRadius: "8px", fontSize: "0.88rem", fontWeight: 600, marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Icon.AlertCircle width={18} height={18} />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div style={{ padding: "0.6rem 0.9rem", background: "#dcfce7", color: "#16a34a", borderRadius: "8px", fontSize: "0.88rem", fontWeight: 600, marginBottom: "1rem" }}>
                {passwordSuccess}
              </div>
            )}

            <div className="profile-password__grid">
              <label className="profile-field profile-field--full">
                <span>Current Password*</span>
                <PasswordInput
                  placeholder="Enter your current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label className="profile-field profile-field--full">
                <span>New Password*</span>
                <PasswordInput
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label className="profile-field profile-field--full">
                <span>Confirm New Password*</span>
                <PasswordInput
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
            </div>

            <div className="profile-actions" style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                className="btn profile-secondary-btn"
                onClick={() => {
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  setPasswordError("");
                  setPasswordSuccess("");
                }}
              >
                Reset
              </button>
              <button
                type="submit"
                className="btn btn--primary"
                disabled={isChangingPassword || !currentPassword || !newPassword}
              >
                {isChangingPassword ? "Updating..." : "Update Password"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
