import React from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { getReceptionStats } from "@/rsc-data/reception/get-reception-stats";
import { ReceptionStatsCards } from "@/components/reception/ReceptionStatsCards";

export default async function HomePage() {
  const stats = await getReceptionStats();

  const quickLinks = [
    {
      title: "Tiếp Nhận & Đăng Ký Khám",
      description: "Tiếp đón bệnh nhân, kiểm tra thẻ BHYT, chống trùng lặp hồ sơ và tạo liệu trình điều trị.",
      href: "/reception",
      badge: "Hàng ngày",
      color: "bg-teal-50 text-teal-700 border-teal-200",
    },
    {
      title: "Lịch Hẹn & Ma Trận Tháng",
      description: "Bảng ma trận tháng 31 ngày phân theo bác sĩ và dòng thời gian 5 phút ngày.",
      href: "/schedule",
      badge: "Ma trận động",
      color: "bg-sky-50 text-sky-700 border-sky-200",
    },
    {
      title: "Quản Lý Hồ Sơ Bệnh Nhân",
      description: "Tra cứu hồ sơ 360°, lịch sử liệu trình (LT1, LT2...), chỉ số sinh hiệu và thẻ bảo hiểm.",
      href: "/patients",
      badge: "Hồ sơ gốc",
      color: "bg-purple-50 text-purple-700 border-purple-200",
    },
    {
      title: "Nhập Dữ Liệu Excel Cũ",
      description: "Pipeline chuyển đổi sổ theo dõi Excel nhiều bác sĩ, kiểm tra chuẩn hóa và nạp dữ liệu.",
      href: "/migration",
      badge: "Staging Pipeline",
      color: "bg-amber-50 text-amber-700 border-amber-200",
    },
  ];

  return (
    <AppShell
      title="Hệ Thống Quản Lý Tiếp Nhận & Lịch Trị Liệu Thuận Thiên"
      subtitle="Phòng khám Y Học Cổ Truyền — Phiên bản chuẩn hóa Next.js & Supabase"
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Real-time stats */}
        <ReceptionStatsCards stats={stats} />

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="group block">
              <Card className="h-full hover:border-teal-400 hover:shadow-md transition-all">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="group-hover:text-teal-700 transition-colors">
                      {link.title}
                    </CardTitle>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${link.color}`}>
                      {link.badge}
                    </span>
                  </div>
                  <CardDescription className="pt-1.5">{link.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <span className="inline-flex items-center text-xs font-semibold text-teal-600 group-hover:translate-x-1 transition-transform">
                    Truy cập module
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
