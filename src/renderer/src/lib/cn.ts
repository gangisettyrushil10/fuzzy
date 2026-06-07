// Tiny classnames joiner — filters out falsy values so conditional classes
// read cleanly: cn('base', active && 'is-active', className).
export type ClassValue = string | number | false | null | undefined

export function cn(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ')
}
