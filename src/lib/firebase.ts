import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { User } from '../types';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();

export const googleSignIn = async (): Promise<User | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    return {
      id: `google-${user.uid}`,
      name: user.displayName || user.email?.split('@')[0] || 'Utilisateur Google',
      email: user.email || '',
      avatarUrl: user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.uid)}`,
      isGoogleAuth: true
    };
  } catch (error: any) {
    console.error('Erreur Firebase Google SignIn:', error);
    throw error;
  }
};

export const googleSignOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Erreur Firebase SignOut:', error);
  }
};
