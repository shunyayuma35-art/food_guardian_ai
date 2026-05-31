import { NextResponse } from 'next/server'
import { networkInterfaces } from 'os'

export async function GET() {
  try {
    const nets = networkInterfaces()
    let ip = '127.0.0.1'

    // 社内LAN のIPアドレスを取得（192.168.x.x / 10.x.x.x / 172.x.x.x）
    outer: for (const name of Object.keys(nets)) {
      for (const net of nets[name] ?? []) {
        if (net.family === 'IPv4' && !net.internal) {
          ip = net.address
          break outer
        }
      }
    }

    const port = process.env.PORT ?? '3001'
    return NextResponse.json({ ip, port, url: `http://${ip}:${port}` })
  } catch (err) {
    console.error('[GET /api/server-info]', err)
    return NextResponse.json({ ip: 'localhost', port: '3001', url: 'http://localhost:3001' })
  }
}
