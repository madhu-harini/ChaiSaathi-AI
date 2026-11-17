# ChaiSaathi AI — Multilingual Voice Khata

A voice-first khata prototype for small chai and neighbourhood shops. The interface is designed for quick use on a laptop or phone, with large controls and a simple customer ledger.

## Run it
1. Extract this ZIP and open the `chaisaathi-voice-khata` folder in VS Code.
2. Open Terminal → New Terminal.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local URL Vite prints (usually http://localhost:5173).

## Core workflow
- Choose Telugu, Hindi/Hinglish, or English.
- Tap the microphone and speak a transaction, or type it as a fallback.
- ChaiSaathi reads back the detected customer, amount, and transaction type.
- Confirm with **Avunu / Haan / Yes** or cancel with **Kaadu / Nahi / No**. On-screen buttons are always available as a fallback.
- Customer balances, today's credit/payments, and purchase checklist update after confirmation.

## Example commands
- English: `Add 50 rupees credit for Ramesh`
- Hindi/Hinglish: `Ramesh ko 50 rupaye udhaar`
- Hindi/Hinglish payment: `Ramesh ne 20 rupaye diye`
- Telugu: `రమేష్ కి 50 రూపాయలు బాకీ రాయి`
- Purchase: `Order 20 packets of milk`

## Added usability features
- Shop pulse: active dues, overdue customer count/value, pending purchases, and highest outstanding customer.
- Searchable customer ledger, sorted by highest balance.
- Overdue age is based on remaining unpaid credit, applying payments to older credit entries first.
- Export transaction history as CSV for a spreadsheet or backup.
- WhatsApp reminder drafts for customers with an outstanding balance.
- Undo the latest saved transaction batch.

## Important limitations
- This is a local prototype. Data is stored in this browser using localStorage; it is not cloud-synced and may be lost if browser data is cleared. Export the CSV periodically if you need a separate copy.
- Use Chrome or Edge and allow microphone access.
- Speech recognition quality depends on browser/OS speech services and may vary, especially for Telugu and Hinglish. Selecting a language requests that recognition language; it cannot install or guarantee a speech model.
- Review the spoken read-back before confirming a transaction.
- WhatsApp reminders open a prefilled message; the shopkeeper must review and send it.
- This prototype does not process or verify payments.
