import type { ThemeConfig } from "antd";

export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: "#0f766e", // Medical Teal (Thuận Thiên brand)
    colorInfo: "#0284c7",
    colorSuccess: "#10b981",
    colorWarning: "#f59e0b",
    colorError: "#ef4444",
    colorBgLayout: "#f8fafc",
    colorBgContainer: "#ffffff",
    colorBorder: "#e2e8f0",
    colorBorderSecondary: "#f1f5f9",
    colorText: "#1e293b",
    colorTextSecondary: "#64748b",
    borderRadius: 6,
    fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Layout: {
      bodyBg: "#f8fafc",
      headerBg: "#ffffff",
      siderBg: "#ffffff",
    },
    Menu: {
      itemBg: "#ffffff",
      itemSelectedBg: "#f0fdfa",
      itemSelectedColor: "#0f766e",
      itemHoverBg: "#f8fafc",
      itemBorderRadius: 6,
      itemMarginInline: 8,
      itemHeight: 40,
    },
    Card: {
      headerHeight: 48,
      paddingLG: 16,
    },
    Table: {
      headerBg: "#f8fafc",
      headerColor: "#475569",
      rowHoverBg: "#f0fdfa",
      cellPaddingBlock: 10,
      cellPaddingInline: 12,
    },
    Button: {
      controlHeight: 36,
      borderRadius: 6,
    },
    Statistic: {
      contentFontSize: 24,
    },
  },
};
