export function createRNG(seed) {
  let s = seed >>> 0
  return {
    next() {
      s |= 0
      s = (s + 0x6D2B79F5) | 0
      let t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    },
    nextInt(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min
    },
    shuffle(arr) {
      const a = [...arr]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]]
      }
      return a
    },
    choice(arr) {
      return arr[Math.floor(this.next() * arr.length)]
    }
  }
}

export function seedFromParticipant(id) {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    const ch = id.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash |= 0
  }
  return Math.abs(hash) || 1
}
