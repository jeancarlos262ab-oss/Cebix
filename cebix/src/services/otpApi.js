async function callOtpApi(path, body) {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }

    if (!response.ok) {
      return { data: null, error: new Error(payload?.error || "request_failed") };
    }
    return { data: payload, error: null };
  } catch {
    return { data: null, error: new Error("network_error") };
  }
}

export function sendSignupOtp({ email, password, name }) {
  return callOtpApi("/api/send-otp", { type: "signup", email, password, name });
}

export function verifySignupOtpApi({ email, code }) {
  return callOtpApi("/api/verify-otp", { type: "signup", email, code });
}

export function sendResetOtp({ email }) {
  return callOtpApi("/api/send-otp", { type: "reset", email });
}

export function checkResetOtpApi({ email, code }) {
  return callOtpApi("/api/verify-otp", { type: "reset_check", email, code });
}

export function verifyResetOtpApi({ email, code, newPassword }) {
  return callOtpApi("/api/verify-otp", { type: "reset", email, code, newPassword });
}