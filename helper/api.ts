import axios, { AxiosError } from 'axios';

const API_URL = 'http://192.168.x.x:8000'; 

interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
}

interface ApiError {
  detail: string | Array<{ msg: string }>;
}

export const loginUser = async (email: string, password: string): Promise<LoginResponse> => {
  try {
    const response = await axios.post<LoginResponse>(`${API_URL}/login`, {
      email,
      password,
    });
    
    return response.data;
  } catch (error) {
    const err = error as AxiosError<ApiError>;
    
    if (err.response) {
      throw err.response.data;
    }
    throw new Error("Erreur réseau ou serveur injoignable");
  }
};