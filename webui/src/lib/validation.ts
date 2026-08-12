import { z } from "zod";

const hostnameRegex =
  /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const addDomainSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1, "Domain is required")
    .regex(hostnameRegex, "Enter a valid hostname, e.g. home.example.com"),
});

export const setupCodeSchema = z.object({
  code: z.string().trim().min(1, "Access code is required"),
});

export const domainParamSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(1)
    .regex(hostnameRegex, "Invalid domain"),
});

export type AddDomainInput = z.infer<typeof addDomainSchema>;
export type SetupCodeInput = z.infer<typeof setupCodeSchema>;
