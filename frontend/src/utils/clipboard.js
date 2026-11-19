/** Copy text to the clipboard with a legacy fallback for non-secure contexts. */
export const copyToClipboard = async (text) => {
    if (!text) return false
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        return true
    }
    const textarea = document.createElement('textarea')
    try {
        textarea.value = text
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        return document.execCommand('copy')
    } finally {
        textarea.parentNode?.removeChild(textarea)
    }
}
