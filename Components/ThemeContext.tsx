import React, { createContext, ReactNode, useState } from 'react';

type ThemeContextType = {
  isDarkTheme: boolean;
  setIsDarkTheme: (value: boolean) => void;
};

export const ThemeContext = createContext<ThemeContextType>({
  isDarkTheme: false,
  setIsDarkTheme: () => {},
});

type Props = {
  children: ReactNode;
};

export const ThemeProvider = ({ children }: Props) => {
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  return (
    <ThemeContext.Provider value={{ isDarkTheme, setIsDarkTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
