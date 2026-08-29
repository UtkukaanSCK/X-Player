import { useCallback, useEffect, useRef, useState } from 'react'

export interface ToastMessage {
  id: number
  text: string
}

/** Brief feedback: "+10s", "Volume 60%", "1.5x". */
export function useToast() {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const idRef = useRef(0)
  const timerRef = useRef<number | null>(null)

  const show = useCallback((text: string) => {
    idRef.current += 1
    setToast({ id: idRef.current, text })
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setToast(null), 900)
  }, [])

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  return { toast, show }
}

export function Toast({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null
  return (
    <div className="xp-toast" key={toast.id} role="status" aria-live="polite">
      {toast.text}
    </div>
  )
}
