import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    position: 'absolute',
    top: 20,
    left: 20,
    fontSize: 24,
    fontWeight: "bold",
  },

  light: {
    backgroundColor: "#FFFFFF",
  },
  dark: {
    backgroundColor: "#000000",
  },

  text: {
    fontSize: 24,
    marginBottom: 20,
  },

  lightText: {
    color: "#000000",
  },
  darkText: {
    color: "#FFFFFF",
  },

  button: {
    position: 'absolute',
    top: 20,
    right: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#3b82f6",
    borderRadius: 8,
  },

  buttonText: {
    color: "#fff",
    fontSize: 18,
  }
});
