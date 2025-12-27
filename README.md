# Uni Connect (Student Chat)

An Omegle-style chat application for university students with real-time video meetings and text chat. Built with Next.js, React, and WebRTC for peer-to-peer communication.

## ⚠️ Disclaimer

**This is an open-source project provided "AS IS", without warranty of any kind, express or implied. The author(s) and contributor(s) of this project are not responsible for any damages, losses, or liabilities arising from the use of this software. Use at your own risk.**

By using this software, you acknowledge that:
- The author(s) make no guarantees about security, privacy, or reliability
- You are solely responsible for compliance with applicable laws and regulations
- The author(s) are not liable for any user-generated content or interactions
- This software is provided for educational and experimental purposes

See the [LICENSE](LICENSE) file for complete terms.

## Features

- **Real-time Chat**: Connect with random university students in real-time
- **Video Meetings**: WebRTC-based peer-to-peer video calls
- **No Database**: All profile data stored client-side in localStorage
- **No Accounts**: Anonymous chat experience with temporary profiles
- **Profile Filtering**: Match based on university, major, and interests
- **In-Memory Signaling**: Server-side signaling for WebRTC connections

## Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **Communication**: WebRTC DataChannel
- **Validation**: Zod
- **Build Tool**: Next.js with Turbopack

## Prerequisites

- Node.js 18.x or higher
- npm, pnpm, or yarn package manager

## Installation

1. Clone the repository:
```bash
git clone https://github.com/MohamedKamran/thetimeclass.git
cd thetimeclass
```

2. Install dependencies:
```bash
pnpm install
# or
npm install
# or
yarn install
```

## Usage

### Development Mode

Run the development server:

```bash
pnpm dev
# or
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

Build the application for production:

```bash
pnpm build
# or
npm run build
```

Start the production server:

```bash
pnpm start
# or
npm start
```

### Linting

Run ESLint to check code quality:

```bash
pnpm lint
# or
npm run lint
```

## How It Works

1. **Setup**: Users create a temporary profile with name, age, university, major, and interests
2. **Profile Storage**: Profile data is stored in browser's localStorage (no server-side storage)
3. **Matching**: Users are connected with other students based on profile criteria
4. **Signaling**: Server provides in-memory signaling for WebRTC connection establishment
5. **P2P Communication**: Once connected, chat and video data flows directly between peers via WebRTC

## Project Structure

```
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── (site)/       # Main site routes
│   │   └── api/          # API routes for signaling
│   ├── components/       # React components
│   │   ├── chat/         # Chat interface components
│   │   ├── meet/         # Meeting room components
│   │   ├── setup/        # Profile setup components
│   │   └── ui/           # Reusable UI components
│   └── lib/              # Utility libraries
│       ├── id.ts         # ID generation
│       ├── profile.ts    # Profile management
│       └── signalingStore.ts  # Signaling logic
├── public/               # Static assets
└── package.json          # Project dependencies
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. By contributing to this project, you agree that your contributions will be licensed under the MIT License.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Important Notice

**THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY ARISING FROM THE USE OF THIS SOFTWARE.**

This is an experimental project. Users should be aware of privacy and security considerations when using peer-to-peer communication applications.

---

**Made with ❤️ for university students**
