"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { AlertCircle, Lock, Mail } from "lucide-react";
import { isFirebaseEnabled, signInWithFirebaseEmail } from "@/lib/firebase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      let firebaseIdToken: string | undefined;
      if (isFirebaseEnabled()) {
        firebaseIdToken = await signInWithFirebaseEmail(email, password);
      }

      const result = await signIn("credentials", {
        email,
        password: firebaseIdToken ? undefined : password,
        firebaseIdToken,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        setIsLoading(false);
      } else {
        // Successful login
        router.push("/fleet");
      }
    } catch (err) {
      const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Firebase rejected this email/password. Check the Firebase user exists and has a password set.");
      } else if (code === "auth/user-disabled") {
        setError("This Firebase user is disabled.");
      } else if (code === "auth/too-many-requests") {
        setError("Firebase temporarily blocked this login due to too many attempts.");
      } else {
        setError("Login failed. Check Firebase Auth and backend auth configuration.");
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-bg-primary via-bg-primary to-[#001e26] p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-accent-teal rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-accent-teal/20">
            <span className="text-bg-primary font-bold text-2xl">T</span>
          </div>
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Trickee</h1>
          <p className="text-text-dim mt-2">EV Intelligence Platform</p>
        </div>

        <Card className="border-bg-border/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-center text-xl">Welcome back</CardTitle>
            <CardDescription className="text-center">Sign in to manage your EV fleet</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-text-dim uppercase tracking-wider ml-1" htmlFor="email">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                  <input
                    id="email"
                    type="email"
                    placeholder="fleet@evify.in"
                    className="w-full bg-bg-primary border border-bg-border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-teal transition-colors"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-text-dim uppercase tracking-wider ml-1" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
                  <input
                    id="password"
                    type="password"
                    placeholder="Password"
                    className="w-full bg-bg-primary border border-bg-border rounded-lg py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-accent-teal transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-xs">
                  <AlertCircle className="w-4 h-4" />
                  <span>{error}</span>
                </div>
              )}

              <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
