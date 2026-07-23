// Stubbed auth calls — swap the bodies for real API/Firebase calls later.

export async function signIn(email: string, password: string) {
  if (!email || !password) throw new Error('Email and password are required.')
  await new Promise((r) => setTimeout(r, 600))
}

export async function sendPasswordReset(email: string) {
  if (!email) throw new Error('Email is required.')
  await new Promise((r) => setTimeout(r, 600))
}

export async function resetPassword(newPassword: string) {
  if (newPassword.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }
  await new Promise((r) => setTimeout(r, 600))
}
