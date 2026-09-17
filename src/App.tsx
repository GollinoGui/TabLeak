import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { ThemeProvider } from '@/hooks/use-theme'
import { LibraryProvider } from '@/store/library-store'
import { HomePage } from '@/pages/home-page'
import { EditorPage } from '@/pages/editor-page'
import { TrashPage } from '@/pages/trash-page'

function App() {
  return (
    <ThemeProvider>
      <LibraryProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/lixeira" element={<TrashPage />} />
            <Route path="/tabs/:tabId" element={<EditorPage />} />
          </Routes>
        </BrowserRouter>
      </LibraryProvider>
    </ThemeProvider>
  )
}

export default App
