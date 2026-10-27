import { z } from "zod";

export const logInSchema = z.object({
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1, "Tell us what to call you").max(80),
  email: z.email("Enter a valid email address").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters").max(200),
});

export type AuthFormState = {
  error?: string;
  notice?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password", string>>;
  values?: { name?: string; email?: string };
};
