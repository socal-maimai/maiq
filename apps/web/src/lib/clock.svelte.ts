class Clock {
  now = $state(new Date())

  start(intervalMs = 30_000): () => void {
    const timer = setInterval(() => {
      this.now = new Date()
    }, intervalMs)
    return () => clearInterval(timer)
  }
}

export const clock = new Clock()
