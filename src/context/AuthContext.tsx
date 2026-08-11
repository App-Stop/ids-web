import { createContext, useContext, useState, type ReactNode } from "react";
import api from "../api/axiosInstance";

export type Role = "admin" | "crew-lead" | "labor" | string;

// The API uses "labor"; "labour" is accepted too so either spelling routes correctly.
export const CREW_ROLES = ["crew-lead", "labor", "labour"] as const;

export function isCrewRole(role: Role | null | undefined): boolean {
  return !!role && (CREW_ROLES as readonly string[]).includes(role);
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  profilePicture?: string | null;
}

interface AccountPayload {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  profilePicture?: string | null;
  isActive: boolean;
}

interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    // the admin endpoint returns `admin`, the crew endpoint returns `user`
    admin?: AccountPayload;
    user?: AccountPayload;
  };
}

interface AuthContextType {
  user: User | null;
  adminLogin: (email: string, password: string) => Promise<LoginResponse>;
  userLogin: (email: string, password: string) => Promise<LoginResponse>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCrew: boolean;
  role: Role | null;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthContextType | null>(null);

function toUser(account: AccountPayload): User {
  return {
    id: account._id,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    role: account.role,
    isActive: account.isActive,
    profilePicture: account.profilePicture ?? null,
  };
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem("user");
      const token = localStorage.getItem("accessToken");
      if (savedUser && token) {
        return JSON.parse(savedUser);
      }
    } catch (e) {
      console.error("Failed to parse saved user from localStorage", e);
    }
    return null;
  });

  const login = async (endpoint: string, email: string, password: string) => {
    const { data: body } = await api.post<LoginResponse>(endpoint, {
      email,
      password,
    });

    const token = body.data?.token;
    const account = body.data?.admin ?? body.data?.user;

    // Guard against a 200 response that still signals failure
    if (body.success === false || !token || !account) {
      throw new Error(body.message ?? "Login failed");
    }

    const loggedInUser = toUser(account);

    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);

    return body;
  };

  const adminLogin = (email: string, password: string) =>
    login("/admin/login", email, password);

  const userLogin = (email: string, password: string) =>
    login("/auth/login", email, password);

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    setUser(null);
  };

  const role = user?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        adminLogin,
        userLogin,
        logout,
        isAuthenticated: !!user,
        isAdmin: role === "admin",
        isCrew: isCrewRole(role),
        role,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
