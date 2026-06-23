function mergeAbortSignals(signals: Array<AbortSignal | null | undefined>): AbortSignal {
  const activeSignals = signals.filter((signal): signal is AbortSignal => signal != null)
  if (activeSignals.length === 0) return new AbortController().signal
  if (activeSignals.length === 1) return activeSignals[0]

  const controller = new AbortController()
  for (const signal of activeSignals) {
    if (signal.aborted) {
      controller.abort()
      return controller.signal
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  return controller.signal
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8_000,
): Promise<Response> {
  const timeoutController = new AbortController()
  const timeoutId = window.setTimeout(() => timeoutController.abort(), timeoutMs)
  const signal = mergeAbortSignals([init.signal, timeoutController.signal])

  try {
    return await fetch(input, { ...init, signal })
  } finally {
    window.clearTimeout(timeoutId)
  }
}
