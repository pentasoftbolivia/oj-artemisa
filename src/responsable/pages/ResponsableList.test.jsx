import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import ResponsableList from './ResponsableList';
import responsableReducer from '@/store/responsable/responsableSlice';
import { ToastProvider } from '@/components/ui/toast';

// Mock matchMedia for Radix UI
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Create a minimal mock store
const createMockStore = () => configureStore({
  reducer: {
    responsable: responsableReducer,
  },
  preloadedState: {
    responsable: {
      items: [],
      loading: false,
      error: null,
      sortedItems: []
    }
  }
});

describe('ResponsableList Component', () => {
  it('renders correctly without crashing', () => {
    const store = createMockStore();
    
    render(
      <Provider store={store}>
        <ToastProvider>
          <ResponsableList />
        </ToastProvider>
      </Provider>
    );

    // Assert that the title is rendered
    expect(screen.getByText('Responsables')).toBeInTheDocument();
    expect(screen.getByText('Lista de Responsables')).toBeInTheDocument();
  });
});
