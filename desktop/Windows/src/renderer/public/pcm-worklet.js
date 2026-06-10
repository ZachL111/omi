// Downstream of AudioSourceManager.swift's mixer: emits 2048-sample (128 ms @ 16 kHz)
// Int16 mono PCM frames, the exact frame size the Mac app streams to /v4/listen.
class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.chunks = []
    this.total = 0
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0]
    if (channel && channel.length) {
      this.chunks.push(new Float32Array(channel))
      this.total += channel.length
      while (this.total >= 2048) {
        const frame = new Float32Array(2048)
        let offset = 0
        while (offset < 2048) {
          const head = this.chunks[0]
          const take = Math.min(head.length, 2048 - offset)
          frame.set(head.subarray(0, take), offset)
          offset += take
          if (take === head.length) this.chunks.shift()
          else this.chunks[0] = head.subarray(take)
        }
        this.total -= 2048
        const pcm = new Int16Array(2048)
        for (let i = 0; i < 2048; i++) {
          const s = Math.max(-1, Math.min(1, frame[i]))
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
        }
        this.port.postMessage(pcm.buffer, [pcm.buffer])
      }
    }
    return true
  }
}

registerProcessor('pcm-processor', PCMProcessor)
