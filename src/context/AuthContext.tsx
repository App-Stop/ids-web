import { createContext, useContext, useState, type ReactNode } from "react";
import api from "../api/axiosInstance";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface AdminPayload {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  profilePicture: string | null;
  isActive: boolean;
}

interface LoginResponse {
  success: boolean;
  message: string;
  data?: {
    token: string;
    admin: AdminPayload;
  };
}

interface AuthContextType {
  user: User | null;
  adminLogin: (email: string, password: string) => Promise<any>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthContext = createContext<AuthContextType | null>(null);

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

  const adminLogin = async (email: string, password: string) => {
    const { data: body } = await api.post<LoginResponse>("/admin/login", {
      email,
      password,
    });

    const token = body.data?.token;
    const admin = body.data?.admin;

    // Guard against a 200 response that still signals failure
    if (body.success === false || !token || !admin) {
      throw new Error(body.message ?? "Login failed");
    }

    const loggedInUser: User = {
      id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      email: admin.email,
      role: admin.role,
      isActive: admin.isActive,
    };

    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(loggedInUser));
    setUser(loggedInUser);

    return body;
  };

  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        adminLogin,
        logout,
        isAuthenticated: !!user,
        isAdmin: user?.role === "admin",
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
