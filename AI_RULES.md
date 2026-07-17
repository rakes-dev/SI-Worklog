# AI Rules & Guidelines

## Tech Stack
- **Next.js 15 (App Router)**: Modern React framework utilizing Server and Client Components.
- **React 19**: Latest React features, hooks, and state management.
- **Zustand**: Lightweight, fast, and persistent state management for global application state.
- **Tailwind CSS**: Utility-first CSS framework for responsive, modern, and clean styling.
- **Firebase Firestore**: Real-time NoSQL database with offline persistence enabled.
- **Lucide React**: Icon library for clean, consistent, and modern iconography.
- **React Hook Form**: Performant, flexible, and extensible forms with easy validation.

## Library & Architecture Rules
- **State Management**: Use Zustand (`src/store/useAppStore.ts`) for global UI state, theme, sidebar, and cached jobs.
- **Database Operations**: All database interactions must go through `src/services/db.ts` which wraps Firebase Firestore with offline-first fallbacks.
- **Styling**: Always use Tailwind CSS. Do not write custom CSS unless absolutely necessary (e.g., print styles in `src/styles/tailwind.css`).
- **Icons**: Exclusively use `lucide-react` for icons.
- **Forms**: Use `react-hook-form` for complex forms (like job creation and form editor) to ensure high performance and clean validation.
- **Print Layouts**: Maintain the pixel-accurate A4 portrait print layout replication for Standard Interior paper forms.