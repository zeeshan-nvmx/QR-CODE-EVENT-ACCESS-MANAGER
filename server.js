const express = require('express')
require('dotenv').config()
const mongoose = require('mongoose')
const QRCode = require('qrcode')
const cors = require('cors')
const fs = require('fs').promises
const path = require('path')
const xlsx = require('node-xlsx')
const moment = require('moment-timezone')

const app = express()
app.use(cors())
app.use(express.json())

mongoose.connect(process.env.MONGODB_URI)

const QRCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  codeNumber: { type: Number, unique: true },
  category: { type: String, required: true },
  used: { type: Boolean, default: false },
  usedAt: Date,
})

const QRCodeModel = mongoose.model('QRCode', QRCodeSchema)

// app.post('/api/generate-codes', async (req, res) => {
//   try {
//     const { amount, category } = req.body
//     if (!category) {
//       return res.status(400).json({ success: false, message: 'Category is required' })
//     }

//     const codes = []
//     const outputDir = path.join(__dirname, 'qrcodes', category.toLowerCase())
//     await fs.mkdir(outputDir, { recursive: true })
//     const lastCode = await QRCodeModel.findOne().sort('-codeNumber')
//     let startNumber = lastCode ? lastCode.codeNumber + 1 : 1

//     for (let i = 0; i < amount; i++) {
//       const code = `EVENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
//       const codeNumber = startNumber + i
//       await QRCode.toFile(path.join(outputDir, `qr-${codeNumber}.png`), code, { width: 300 })
//       codes.push({ code, codeNumber, category })
//     }

//     await QRCodeModel.insertMany(codes)
//     res.json({
//       success: true,
//       message: `Generated ${amount} QR codes in category ${category}`,
//       directory: outputDir,
//     })
//   } catch (error) {
//     res.status(500).json({ success: false, error: error.message })
//   }
// })

app.post('/api/scan', async (req, res) => {
  try {
    const { qrCode } = req.body
    const code = await QRCodeModel.findOne({ code: qrCode })

    if (!code) {
      return res.json({ message: 'Invalid QR code' })
    }

    if (code.used) {
      return res.json({
        success: false,
        message: 'QR code already used',
        data: {
          codeNumber: code.codeNumber,
          category: code.category,
          used: code.used,
          usedAt: moment(code.usedAt).tz('Asia/Dhaka').format(),
        },
      })
    }

    code.used = true
    code.usedAt = moment().tz('Asia/Dhaka').toDate()
    await code.save()

    res.status(200).json({
      success: true,
      message: 'access granted, enjoy',
      data: {
        codeNumber: code.codeNumber,
        category: code.category,
        used: code.used,
        usedAt: moment(code.usedAt).tz('Asia/Dhaka').format(),
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/reset-code', async (req, res) => {
  try {
    const { code } = req.body
    const qrCode = await QRCodeModel.findOne({ code: code })

    if (!qrCode) {
      return res.status(404).json({ success: false, message: 'Code not found' })
    }

    qrCode.used = false
    qrCode.usedAt = null
    await qrCode.save()

    res.status(200).json({
      success: true,
      message: 'qr code has been successfully reset. You can use this qr code again to enter',
      data: {
        codeNumber: qrCode.codeNumber,
        category: qrCode.category,
        used: qrCode.used,
        usedAt: null,
      },
    })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/export-excel', async (req, res) => {
  try {
    const codes = await QRCodeModel.find({})

    const data = [
      ['Code Number', 'Category', 'QR Code', 'Used', 'Used At'], // Headers
      ...codes.map((code) => [
        code.codeNumber,
        code.category,
        code.code,
        code.used ? 'Yes' : 'No',
        code.usedAt ? moment(code.usedAt).tz('Asia/Dhaka').format('YYYY-MM-DD HH:mm:ss') : '',
      ]),
    ]

    const buffer = xlsx.build([{ name: 'QR Codes', data: data }])
    const fileName = `qr-codes-${Date.now()}.xlsx`
    const filePath = path.join(__dirname, fileName)

    await fs.writeFile(filePath, buffer)

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
    res.sendFile(filePath)
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`Server running on port ${PORT}`))

