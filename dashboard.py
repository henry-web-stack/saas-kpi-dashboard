"""
SaaS KPI Dashboard — Streamlit Edition
Run: streamlit run dashboard.py
Requires: DATABASE_URL environment variable (PostgreSQL connection string)
Install: pip install -r requirements-dashboard.txt
"""

import os
import io
import math
import streamlit as st
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

st.set_page_config(
    page_title="SaaS KPI Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ── Database ──────────────────────────────────────────────────────────────────

DATABASE_URL = os.getenv("DATABASE_URL")

@st.cache_resource
def get_connection():
    if not DATABASE_URL:
        st.error("DATABASE_URL is not set. Add it to your .env file or environment.")
        st.stop()
    return psycopg2.connect(DATABASE_URL)

def query(sql: str, params=None) -> pd.DataFrame:
    conn = get_connection()
    try:
        return pd.read_sql_query(sql, conn, params=params)
    except Exception:
        conn = psycopg2.connect(DATABASE_URL)
        st.cache_resource.clear()
        return pd.read_sql_query(sql, conn, params=params)

# ── Helpers ───────────────────────────────────────────────────────────────────

PERIOD_OPTIONS = {
    "Last 6 Months": 6,
    "Last 12 Months": 12,
    "Last 24 Months": 24,
}

def get_period_start(months: int) -> str:
    return pd.Timestamp.now().normalize() - pd.DateOffset(months=months)

def fmt_currency(v: float) -> str:
    if v >= 1_000_000:
        return f"${v/1_000_000:.1f}M"
    if v >= 1_000:
        return f"${v/1_000:.1f}k"
    return f"${v:,.2f}"

def fmt_change(v: float, positive_good: bool = True) -> str:
    arrow = "▲" if v > 0 else ("▼" if v < 0 else "–")
    color = "green" if (v > 0) == positive_good else ("red" if v != 0 else "gray")
    return f":{color}[{arrow} {abs(v):.1f}%]"

def compute_churn_risk(row) -> int | None:
    if row["status"] == "churned":
        return None
    score = 0
    t = row["tenure_months"]
    if t < 1: score += 35
    elif t < 3: score += 25
    elif t < 6: score += 15
    elif t < 12: score += 8
    plan_scores = {"starter": 20, "growth": 8, "enterprise": 0}
    score += plan_scores.get(row["plan"], 0)
    if row["status"] == "at_risk":
        score += 30
    plan_avg = {"starter": 20, "growth": 50, "enterprise": 160}.get(row["plan"], 20)
    if float(row["mrr"]) < plan_avg * 0.7:
        score += 10
    return min(100, max(0, score))

def risk_label(score) -> str:
    if score is None: return "—"
    if score >= 76: return f"🔴 {score}"
    if score >= 56: return f"🟠 {score}"
    if score >= 26: return f"🟡 {score}"
    return f"🟢 {score}"

# ── Page Header ───────────────────────────────────────────────────────────────

st.title("📊 SaaS KPI Dashboard")
st.caption("Real-time metrics from your PostgreSQL database")

col_period, col_refresh = st.columns([3, 1])
with col_period:
    period_label = st.selectbox("Period", list(PERIOD_OPTIONS.keys()), index=1, label_visibility="collapsed")
with col_refresh:
    if st.button("🔄 Refresh", use_container_width=True):
        st.cache_data.clear()
        st.rerun()

period_months = PERIOD_OPTIONS[period_label]
period_start = get_period_start(period_months)
period_start_str = period_start.strftime("%Y-%m-%d")

st.divider()

# ── KPI Summary ───────────────────────────────────────────────────────────────

@st.cache_data(ttl=300)
def load_summary(period_start: str) -> pd.DataFrame:
    return query("""
        SELECT * FROM monthly_metrics
        WHERE month >= %s ORDER BY month
    """, (period_start,))

summary_df = load_summary(period_start_str)

if summary_df.empty:
    st.warning("No data found for the selected period.")
    st.stop()

latest = summary_df.iloc[-1]
prev   = summary_df.iloc[-2] if len(summary_df) >= 2 else summary_df.iloc[0]

total_users       = int(latest["total_users"])
mrr               = float(latest["mrr"])
prev_mrr          = float(prev["mrr"])
new_users_period  = int(summary_df["new_users"].sum())
churned_period    = int(summary_df["churned_users"].sum())
arpu              = mrr / total_users if total_users else 0

users_change = ((total_users - int(prev["total_users"])) / max(int(prev["total_users"]), 1)) * 100
mrr_change   = ((mrr - prev_mrr) / max(prev_mrr, 1)) * 100

churn_rate = (int(latest["churned_users"]) / max(int(prev["total_users"]), 1)) * 100
prev_churn = (int(prev["churned_users"]) / max(int(summary_df.iloc[-3]["total_users"]) if len(summary_df) >= 3 else int(prev["total_users"]), 1)) * 100
churn_change = churn_rate - prev_churn

expansion_mrr = float(latest["expansion_mrr"])
churned_mrr   = float(latest["churned_mrr"])
nrr = ((mrr + expansion_mrr - churned_mrr) / max(mrr, 1)) * 100
prev_exp  = float(prev["expansion_mrr"])
prev_churn_mrr = float(prev["churned_mrr"])
prev_nrr  = ((prev_mrr + prev_exp - prev_churn_mrr) / max(prev_mrr, 1)) * 100
nrr_change = nrr - prev_nrr

prev_arpu = float(prev["mrr"]) / max(int(prev["total_users"]), 1)
arpu_change = ((arpu - prev_arpu) / max(prev_arpu, 1)) * 100

# Row 1 — primary KPIs
c1, c2, c3, c4 = st.columns(4)
with c1:
    st.metric("Total Users", f"{total_users:,}", f"{users_change:+.1f}%")
with c2:
    st.metric("MRR", fmt_currency(mrr), f"{mrr_change:+.1f}%")
with c3:
    st.metric("Churn Rate", f"{churn_rate:.2f}%", f"{churn_change:+.2f}pp", delta_color="inverse")
with c4:
    st.metric("NRR", f"{nrr:.1f}%", f"{nrr_change:+.1f}pp")

# Row 2 — secondary KPIs
c5, c6, c7 = st.columns(3)
with c5:
    st.metric("New Users (Period)", f"{new_users_period:,}")
with c6:
    st.metric("Churned Users (Period)", f"{churned_period:,}", delta_color="inverse")
with c7:
    st.metric("ARPU", fmt_currency(arpu), f"{arpu_change:+.1f}%")

st.divider()

# ── Charts ────────────────────────────────────────────────────────────────────

@st.cache_data(ttl=300)
def load_metrics(period_start: str) -> pd.DataFrame:
    df = query("""
        SELECT * FROM monthly_metrics
        WHERE month >= %s ORDER BY month
    """, (period_start,))
    df["month_label"] = pd.to_datetime(df["month"]).dt.strftime("%Y-%m")
    df["mrr"]           = df["mrr"].astype(float)
    df["new_mrr"]       = df["new_mrr"].astype(float)
    df["expansion_mrr"] = df["expansion_mrr"].astype(float)
    df["churned_mrr"]   = df["churned_mrr"].astype(float)
    return df

metrics_df = load_metrics(period_start_str)

col_l, col_r = st.columns(2)

# User Growth chart
with col_l:
    fig = make_subplots(specs=[[{"secondary_y": True}]])
    fig.add_trace(go.Bar(
        x=metrics_df["month_label"], y=metrics_df["new_users"],
        name="New Users", marker_color="#3b9eff", offsetgroup=1
    ), secondary_y=False)
    fig.add_trace(go.Bar(
        x=metrics_df["month_label"], y=-metrics_df["churned_users"],
        name="Churned", marker_color="#ef4444", offsetgroup=1
    ), secondary_y=False)
    fig.add_trace(go.Scatter(
        x=metrics_df["month_label"], y=metrics_df["total_users"],
        name="Total Users", mode="lines", line=dict(color="#a78bfa", width=2)
    ), secondary_y=True)
    fig.update_layout(
        title="User Growth", barmode="relative", height=320,
        legend=dict(orientation="h", y=-0.2), margin=dict(l=0, r=0, t=40, b=0),
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)"
    )
    fig.update_yaxes(title_text="Users", secondary_y=False)
    fig.update_yaxes(title_text="Total", secondary_y=True)
    st.plotly_chart(fig, use_container_width=True)

# MRR Growth chart
with col_r:
    fig2 = go.Figure()
    fig2.add_trace(go.Scatter(
        x=metrics_df["month_label"], y=metrics_df["mrr"],
        name="MRR", mode="lines", fill="tozeroy",
        line=dict(color="#3b9eff", width=2), fillcolor="rgba(59,158,255,0.1)"
    ))
    fig2.add_trace(go.Scatter(
        x=metrics_df["month_label"], y=metrics_df["new_mrr"],
        name="New MRR", mode="lines", line=dict(color="#22c55e", width=1.5, dash="dot")
    ))
    fig2.add_trace(go.Scatter(
        x=metrics_df["month_label"], y=metrics_df["expansion_mrr"],
        name="Expansion", mode="lines", line=dict(color="#a78bfa", width=1.5, dash="dot")
    ))
    fig2.update_layout(
        title="MRR Growth", height=320,
        legend=dict(orientation="h", y=-0.2), margin=dict(l=0, r=0, t=40, b=0),
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)"
    )
    st.plotly_chart(fig2, use_container_width=True)

# Churn Rate chart (full width)
churn_rates = []
for i, row in metrics_df.iterrows():
    idx = metrics_df.index.get_loc(i)
    prev_row = metrics_df.iloc[idx - 1] if idx > 0 else row
    cr = (row["churned_users"] / max(int(prev_row["total_users"]), 1)) * 100
    rev_cr = (row["churned_mrr"] / max(float(prev_row["mrr"]), 1)) * 100
    churn_rates.append({"month": row["month_label"], "user_churn": cr, "rev_churn": rev_cr})

churn_plot_df = pd.DataFrame(churn_rates)
avg_churn = churn_plot_df["user_churn"].mean()

fig3 = go.Figure()
fig3.add_hline(y=avg_churn, line_dash="dash", line_color="gray",
               annotation_text=f"avg {avg_churn:.1f}%", annotation_position="right")
fig3.add_trace(go.Scatter(
    x=churn_plot_df["month"], y=churn_plot_df["user_churn"],
    name="User Churn %", mode="lines+markers", line=dict(color="#ef4444", width=2)
))
fig3.add_trace(go.Scatter(
    x=churn_plot_df["month"], y=churn_plot_df["rev_churn"],
    name="Revenue Churn %", mode="lines+markers", line=dict(color="#f97316", width=2, dash="dot")
))
fig3.update_layout(
    title="Churn Rate", height=280,
    legend=dict(orientation="h", y=-0.25), margin=dict(l=0, r=0, t=40, b=0),
    plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)"
)
st.plotly_chart(fig3, use_container_width=True)

st.divider()

# ── Retention Cohort Heatmap ──────────────────────────────────────────────────

@st.cache_data(ttl=300)
def load_retention() -> pd.DataFrame:
    return query("""
        SELECT cohort_month, month_index, retention_rate, cohort_size
        FROM retention_cohorts
        ORDER BY cohort_month, month_index
    """)

ret_df = load_retention()
if not ret_df.empty:
    st.subheader("Retention Cohorts")
    cohorts = ret_df["cohort_month"].unique()[-6:]
    pivot_data = []
    for c in cohorts:
        row_data = ret_df[ret_df["cohort_month"] == c].sort_values("month_index")
        rates = [float(r) if r is not None else None for r in row_data["retention_rate"]]
        size  = int(row_data.iloc[0]["cohort_size"])
        label = pd.to_datetime(c).strftime("%Y-%m")
        pivot_data.append({"cohort": label, "size": size, **{f"M{i}": v for i, v in enumerate(rates)}})

    pivot_df = pd.DataFrame(pivot_data)
    month_cols = [c for c in pivot_df.columns if c.startswith("M")]
    heat_vals  = pivot_df[month_cols].values.tolist()

    fig_h = go.Figure(go.Heatmap(
        z=heat_vals,
        x=month_cols,
        y=[f"{r['cohort']} (n={r['size']})" for _, r in pivot_df.iterrows()],
        colorscale=[[0, "#1e3a5f"], [0.5, "#3b9eff"], [1, "#93c5fd"]],
        text=[[f"{v:.0f}%" if v is not None else "–" for v in row] for row in heat_vals],
        texttemplate="%{text}",
        showscale=True,
        zmin=0, zmax=100,
    ))
    fig_h.update_layout(
        height=280, margin=dict(l=0, r=0, t=10, b=0),
        plot_bgcolor="rgba(0,0,0,0)", paper_bgcolor="rgba(0,0,0,0)"
    )
    st.plotly_chart(fig_h, use_container_width=True)

st.divider()

# ── Subscriber Drilldown Table ────────────────────────────────────────────────

st.subheader("Subscriber Drilldown")

@st.cache_data(ttl=300)
def load_subscribers() -> pd.DataFrame:
    return query("""
        SELECT id, name, email, plan, status, mrr::float, joined_at,
               churned_at, tenure_months
        FROM subscribers
        ORDER BY mrr DESC
    """)

subs_df = load_subscribers()
if not subs_df.empty:
    subs_df["churn_risk"] = subs_df.apply(compute_churn_risk, axis=1)
    subs_df["risk_label"] = subs_df["churn_risk"].apply(risk_label)

    # Filters
    fcol1, fcol2, fcol3 = st.columns([3, 2, 2])
    with fcol1:
        search_q = st.text_input("Search by name or email", placeholder="Search…", label_visibility="collapsed")
    with fcol2:
        status_filter = st.selectbox("Status", ["All", "active", "at_risk", "churned"], label_visibility="collapsed")
    with fcol3:
        plan_filter = st.selectbox("Plan", ["All", "starter", "growth", "enterprise"], label_visibility="collapsed")

    filtered = subs_df.copy()
    if search_q:
        q = search_q.lower()
        filtered = filtered[
            filtered["name"].str.lower().str.contains(q) |
            filtered["email"].str.lower().str.contains(q)
        ]
    if status_filter != "All":
        filtered = filtered[filtered["status"] == status_filter]
    if plan_filter != "All":
        filtered = filtered[filtered["plan"] == plan_filter]

    st.caption(f"{len(filtered):,} subscribers")

    # Display table
    display_cols = ["name", "email", "plan", "status", "mrr", "risk_label", "tenure_months", "joined_at"]
    display_df = filtered[display_cols].rename(columns={
        "name": "Name", "email": "Email", "plan": "Plan", "status": "Status",
        "mrr": "MRR ($)", "risk_label": "Risk", "tenure_months": "Tenure (mo)", "joined_at": "Joined"
    })

    # Paginate
    PAGE_SIZE = 25
    total_pages = max(1, math.ceil(len(display_df) / PAGE_SIZE))
    page_num = st.number_input("Page", min_value=1, max_value=total_pages, value=1, label_visibility="collapsed")
    start_idx = (page_num - 1) * PAGE_SIZE
    page_df = display_df.iloc[start_idx : start_idx + PAGE_SIZE]

    st.dataframe(page_df, use_container_width=True, hide_index=True)
    st.caption(f"Page {page_num} of {total_pages}")

    # CSV export
    csv_bytes = filtered[display_cols].to_csv(index=False).encode()
    st.download_button(
        label="⬇ Download CSV",
        data=csv_bytes,
        file_name="subscribers.csv",
        mime="text/csv",
    )

st.divider()

# ── File Upload & Analysis ────────────────────────────────────────────────────

st.subheader("Import & Analyze CSV")
st.caption("Upload any CSV file to explore its data with auto-detected column types and charts.")

uploaded = st.file_uploader("Upload CSV", type=["csv"], label_visibility="collapsed")
if uploaded:
    try:
        df_upload = pd.read_csv(uploaded)
        st.success(f"✅ Loaded **{uploaded.name}** — {len(df_upload):,} rows × {len(df_upload.columns)} columns")

        # Summary
        c1u, c2u, c3u, c4u = st.columns(4)
        numeric_cols = df_upload.select_dtypes(include="number").columns.tolist()
        cat_cols = df_upload.select_dtypes(include=["object", "category"]).columns.tolist()
        c1u.metric("Rows", f"{len(df_upload):,}")
        c2u.metric("Columns", len(df_upload.columns))
        c3u.metric("Numeric", len(numeric_cols))
        c4u.metric("Categorical", len(cat_cols))

        # Numeric stats
        if numeric_cols:
            st.markdown("**Numeric Columns**")
            st.dataframe(df_upload[numeric_cols].describe().T.round(2), use_container_width=True)

        # Categorical charts
        if cat_cols:
            st.markdown("**Categorical Distributions**")
            chart_cols = st.columns(min(len(cat_cols), 3))
            for i, col in enumerate(cat_cols[:6]):
                vc = df_upload[col].value_counts().head(10).reset_index()
                vc.columns = [col, "count"]
                with chart_cols[i % len(chart_cols)]:
                    fig_c = px.bar(vc, x=col, y="count", title=col, height=220)
                    fig_c.update_layout(margin=dict(l=0, r=0, t=30, b=0), showlegend=False)
                    st.plotly_chart(fig_c, use_container_width=True)

        # Data preview
        st.markdown("**Data Preview** (first 10 rows)")
        st.dataframe(df_upload.head(10), use_container_width=True, hide_index=True)

    except Exception as e:
        st.error(f"Error reading file: {e}")
