export const VK_PROFILE_STORAGE_KEY = 'avp-vkid-profile'

export function isAuthenticated() {
  return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(VK_PROFILE_STORAGE_KEY))
}
