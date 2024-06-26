"use client"
import { useState } from 'react';
import RegisterForm from './register-form'; // Ensure path is correct
import { db } from '@/lib/db/db';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';
import { AlertCircle, Loader2 } from 'lucide-react';

interface EmailCheckerProps {
    signUp: (email: string, password: string, confirmPassword: string, firstName: string, lastName: string) => Promise<void>;
    errorMsg: string;
    validateEmail: (email: string) => Promise<Boolean>;
}

/**
 * Component to validate an email and check if exists in the database, and if not, proceed to the registration form.
 */
export const EmailChecker = ({ signUp, errorMsg, validateEmail }: EmailCheckerProps) => {
    const [email, setEmail] = useState('');
    const [emailChecked, setEmailChecked] = useState(false);
    const [emailExists, setEmailExists] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const checkEmailExists = async (email: string) => {
        setIsLoading(true);
        try {
            const { found } = await db.profiles.fetch.profile.byEmail(email);
            setIsLoading(false);
            setEmailExists(found);
            if (!found) {
                const valid = await validateEmail(email);
                if (valid) {
                    setEmailChecked(true);
                    setError('');
                } else {
                    setError("Email format is invalid");
                }

            } else {
                setError("Email already exists");
            }
        } catch (err) {
            setError("Failed to check the email");
        }
        setIsLoading(false);
    };

    if (emailChecked && !emailExists) {
        return <RegisterForm setEmailChecked={setEmailChecked} onRegister={signUp} email={email} errorMsg={errorMsg} />;
    }

    // Decide on which error message to display, prioritising server errors first
    const errorMessage = errorMsg || error;

    return (
        <>
            <Link
                href="/"
                className="absolute left-3 top-2 p-2 rounded-md no-underline text-muted-foreground hover:text-foreground transition-colors bg-btn-background hover:bg-btn-background-hover flex items-center group text-sm"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="mr-1 h-4 w-4 transition-transform group-hover:-translate-x-1"
                >
                    <polyline points="15 18 9 12 15 6" />
                </svg>{" "}
                Home
            </Link>
            <div className="h-[80px] flex justify-center items-center">
                <div className="h-12 w-12 border rounded-lg drop-shadow-sm bg-card flex justify-center items-center font-bold text-2xl text-primary">
                    <i>FT</i>
                </div>
            </div>
            <div className="flex flex-col text-center mb-8">
                <h1 className="text-2xl font-semibold tracking-normal">
                    Create Account
                </h1>
                <p className="text-sm text-muted-foreground">
                    Please enter your email to get started
                </p>
            </div>

            <div className="flex flex-col gap-4">
                {errorMessage &&
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            {errorMessage}
                        </AlertDescription>
                    </Alert>
                }
                <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    disabled={isLoading}
                />
                {!isLoading &&
                    <Button type="submit" onClick={() => checkEmailExists(email)} disabled={isLoading || !email}>Register</Button>
                }
                {isLoading &&
                    <Button type="button" disabled={true}>
                        <div className="flex gap-2 items-center"><Loader2 size={16} className="animate-spin" /> Loading...</div>
                    </Button>
                }
                <div className="relative mt-2">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">
                            Already registered?
                        </span>
                    </div>
                </div>
                <Link href="/login">
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={isLoading}
                        className="w-full mt-2">
                        Sign In
                    </Button>
                </Link>
            </div>

        </>
    );
};
