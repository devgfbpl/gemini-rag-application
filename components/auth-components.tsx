import { signIn, signOut } from "@/auth"

export function SignInButton() {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#09090b] text-slate-100">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-bold tracking-tight text-[#ccff00]">Welcome Back</h1>
                <p className="text-slate-400">Sign in to continue to Gemini RAG</p>
                <form
                    action={async () => {
                        "use server"
                        await signIn("google")
                    }}
                >
                    <button className="bg-[#3c83f6] hover:bg-[#2563eb] text-white font-bold py-3 px-6 rounded-full transition-colors shadow-lg shadow-[#3c83f6]/20">
                        Sign in with Google
                    </button>
                </form>
            </div>
        </div>
    )
}

export function SignOutButton() {
    return (
        <form
            action={async () => {
                "use server"
                await signOut()
            }}
        >
            <button className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 px-3 py-1.5 rounded transition-colors">
                Sign Out
            </button>
        </form>
    )
}
