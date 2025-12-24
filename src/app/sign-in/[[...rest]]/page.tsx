import { SignIn } from '@clerk/nextjs'

export default function Page() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Retail POS</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to access the Point of Sale system
            </p>
          </div>
          <SignIn />
        </div>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Limited to authorized employees only
        </p>
      </div>
    </div>
  )
}
