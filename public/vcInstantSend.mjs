// Runtime-binding for instant-flowets eksisterende sendehandling.
// Ingen globale DOM- eller storage-afhængigheder ved import.
export function bindInstantSend({ saveButton, discardButton, bridgeReady, upload,
  state, alert }) {
  if (!saveButton || !discardButton) return
  saveButton.textContent = 'Send video til coach'
  saveButton.onclick = async () => {
    if (!bridgeReady()) {
      alert('Forbindelsen til appen er ikke klar. Luk VideoCoach og åbn den fra appen igen.')
      return
    }
    saveButton.disabled = true
    discardButton.disabled = true
    await upload()
    // Uploadfunktionen håndterer selv fejl og åbner sendearket igen.
    if (state() !== 'sent') {
      saveButton.disabled = false
      discardButton.disabled = false
    }
  }
}
