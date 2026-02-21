import { auth } from "@/auth"
import ChatInterface from "@/components/ChatInterface"
import { SignInButton, SignOutButton } from "@/components/auth-components"

export default async function Home() {
    const session = await auth()

    if (!session?.user) {
        return <SignInButton />
    }

    return (
        <ChatInterface
            user={session.user}
            signOutButton={<SignOutButton />}
        />
    )
}
