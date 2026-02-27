"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bug } from "lucide-react";
import { Button, Input, ButtonLoader } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      await login(email, password);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-[400px] bg-white rounded-lg border border-[var(--color-border)] p-8">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-[var(--color-accent)] rounded-lg mb-4">
          <Bug className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          BugBase
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">
          Simple bug & feature tracking
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-[var(--color-danger)] bg-red-50 rounded-md border border-red-100">
            {error}
          </div>
        )}

        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <ButtonLoader />}
          Sign In
        </Button>
      </form>

      {/* Footer */}
      <p className="mt-6 text-center text-sm text-[var(--color-text-secondary)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="text-[var(--color-accent)] hover:underline font-medium"
        >
          Register
        </Link>
      </p>
    </div>
  );
}
