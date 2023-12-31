import DemoTools from "@/components/DemoTools"
import Sidebar from "@/components/Sidebar"

export const metadata = {
    title: 'FastTrak | Dashboard',
    description: 'Parcel logistics and tracking made simple.',
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="h-screen w-full flex flex overflow-hidden">
            <Sidebar />
            <div className="w-full flex flex-col">
                <header className="min-h-[60px] max-h-[60px] w-full flex items-center px-4 border-b justify-end">
                    <DemoTools/>
                </header>
                <div className="flex flex-grow overflow-hidden">
                    <div className="flex-grow p-4 overflow-y-auto">
                        {children}
                    </div>
                </div>

            </div>
        </div>

    )
}
