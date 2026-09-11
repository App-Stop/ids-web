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
        <div className="profile-page__header">
          <div>
            <h1 className="dash__title profile-page__title">Profile</h1>
            <p className="dash__subtitle">
              Manage your account settings and preferences
            </p>
          </div>
        </div>

        <div className="profile-tabs-row">
          <div
            className="profile-tabs"
            role="tablist"
            aria-label="Profile sections"
          >
            <button type="button" className="profile-tab is-active">
              Profile Settings
            </button>
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
              <input defaultValue={profileData?.firstName} />
            </label>
            <label className="profile-field">
              <span>Last Name</span>
              <input defaultValue={profileData?.lastName} />
            </label>
            <label className="profile-field">
              <span>Email Address</span>
              <input defaultValue={profileData?.email} />
            </label>
            <label className="profile-field">
              <span>Role</span>
              <input
                defaultValue={profileData?.role}
                readOnly
                className="profile-field__readonly"
              />
            </label>
          </div>

          <form className="profile-password" onSubmit={handleChangePassword}>
            <h2>Change Password</h2>

            {passwordError && (
              <div className="form-error-alert" style={{ marginBottom: "1rem" }}>
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
                <input
                  placeholder="Enter your current password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </label>
              <label className="profile-field profile-field--full">
                <span>New Password*</span>
                <input
                  placeholder="Enter new password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label className="profile-field profile-field--full">
                <span>Confirm New Password*</span>
                <input
                  placeholder="Re-enter new password"
                  type="password"
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
