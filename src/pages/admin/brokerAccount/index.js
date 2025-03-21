"use client";

import React, { useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import useSWR, { mutate } from "swr";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import DashboardLayout from "..";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const brokerAccountColumns = [
    { accessorKey: "login", header: "Login" },
    { accessorKey: "password", header: "Password" },
    { accessorKey: "balance", header: "Balance" },
    { accessorKey: "server", header: "Server" },
    { accessorKey: "platform", header: "Platform" },
    { accessorKey: "inversorPass", header: "Inversor" },
    { accessorKey: "used", header: "Used" },
];

const fetcher = (url, token) =>
    fetch(url, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    }).then((res) => res.json());

export default function BrokerAccountsTable() {
    const { data: session } = useSession();
    const { data, error } = useSWR(
        session?.jwt
            ? [`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/broker-accounts?filters[used][$eq]=false`, session.jwt]
            : null,
        ([url, token]) => fetcher(url, token)
    );

    const [search, setSearch] = useState("");
    const [selectedAccountType, setSelectedAccountType] = useState(null);
    const [formData, setFormData] = useState({
        login: "",
        password: "",
        server: "",
        balance: "",
        platform: "mt4",
        used: false,
        inversorPass: "",
    });

    const accountTypes = [
        { amount: "5000", label: "$5,000", color: "bg-blue-500" },
        { amount: "10000", label: "$10,000", color: "bg-green-500" },
        { amount: "25000", label: "$25,000", color: "bg-yellow-500" },
        { amount: "50000", label: "$50,000", color: "bg-red-500" },
        { amount: "100000", label: "$100,000", color: "bg-purple-500" },
    ];

    const balanceCounts = useMemo(() => {
        if (!data || !data.data) return {};

        return accountTypes.reduce((acc, { amount }) => {
            acc[amount] = data.data.filter((account) => account.balance == amount).length;
            return acc;
        }, {});
    }, [data]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === "login" && !/^[a-zA-Z0-9]*$/.test(value)) return;

        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const saveBrokerAccount = async () => {
        if (!session?.jwt) {
            toast.error("No hay sesión activa.");
            return;
        }

        if (!formData.login || !formData.password || !formData.server || !formData.balance) {
            toast.warning("Todos los campos son obligatorios.");
            return;
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/broker-accounts`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.jwt}`,
                },
                body: JSON.stringify({ data: formData }),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error("❌ Error Strapi Response:", result);
                throw new Error(result?.error?.message || "Error desconocido en Strapi");
            }

            toast.success("Cuenta guardada exitosamente!");

            // 🔄 ACTUALIZA LA TABLA EN TIEMPO REAL
            mutate(
                [`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/broker-accounts?filters[used][$eq]=false`, session.jwt],
                async (currentData) => {
                    const newData = result.data;
                    return {
                        ...currentData,
                        data: [...(currentData?.data || []), newData],
                    };
                },
                false
            );

            // Reinicia el formulario
            setFormData({
                login: "",
                password: "",
                server: "",
                balance: "",
                platform: "mt4",
                used: false,
                inversorPass: "",
            });
            setSelectedAccountType(null);
        } catch (error) {
            console.error("🚨 Error al guardar en Strapi:", error);
            toast.error("Error al guardar la cuenta.");
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 text-white rounded-lg shadow-lg">
                <h1 className="text-4xl font-bold mb-6">Creador de Broker Accounts</h1>

                {/* Contadores de cuentas */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                    {accountTypes.map(({ amount, label, color }) => (
                        <div key={amount} className={`${color} text-white p-4 rounded-lg shadow-md flex flex-col items-center`}>
                            <span className="text-xl font-bold">{balanceCounts[amount] || 0}</span>
                            <span className="text-sm">{label}</span>
                        </div>
                    ))}
                </div>

                {/* Panel de selección de cuenta */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    <div className="md:col-span-2 p-4 bg-zinc-800 rounded-md shadow-md">
                        <p className="text-lg font-semibold mb-4">Selecciona el tipo de cuenta</p>
                        <div className="grid grid-cols-2 gap-4">
                            {accountTypes.map(({ amount, label, color }) => (
                                <button
                                    key={amount}
                                    onClick={() => {
                                        setSelectedAccountType(label);
                                        setFormData({ ...formData, balance: amount });
                                    }}
                                    className={`${color} text-white p-4 rounded-lg shadow-md flex flex-col items-center hover:opacity-90 transition`}
                                >
                                    <span className="text-xl font-bold">{label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Formulario */}
                        <div className="mt-6 rounded-md shadow-md p-4 bg-zinc-800">
                            <h2 className="text-lg font-semibold text-gray-200">
                                Agregar cuenta - {selectedAccountType}
                            </h2>

                            <Input
                                name="login"
                                placeholder="Ingrese el login..."
                                value={formData.login}
                                onChange={handleInputChange}
                                className="mt-4 h-9 px-3 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 rounded-md"
                            />

                            <Input
                                name="balance"
                                type="number"
                                placeholder="Ingrese el balance..."
                                value={formData.balance}
                                onChange={handleInputChange}
                                className="mt-4 h-9 px-3 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 rounded-md"
                            />

                            <select
                                name="platform"
                                value={formData.platform}
                                onChange={handleInputChange}
                                className="mt-4 h-9 px-3 text-sm w-full bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 rounded-md"
                            >
                                <option value="mt4">MT4</option>
                                <option value="mt5">MT5</option>
                            </select>

                            <Input
                                name="password"
                                type="password"
                                placeholder="Ingrese la contraseña..."
                                value={formData.password}
                                onChange={handleInputChange}
                                className="mt-4 h-9 px-3 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 rounded-md"
                            />

                            <Input
                                name="inversorPass"
                                placeholder="Ingrese el inversorPass..."
                                value={formData.inversorPass}
                                onChange={handleInputChange}
                                className="mt-4 h-9 px-3 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 rounded-md"
                            />

                            <Input
                                name="server"
                                placeholder="Ingrese el servidor..."
                                value={formData.server}
                                onChange={handleInputChange}
                                className="mt-4 h-9 px-3 text-sm bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-200 border-zinc-300 dark:border-zinc-700 rounded-md"
                            />

                            <Button className="mt-4 w-full" onClick={saveBrokerAccount}>
                                Guardar Cuenta
                            </Button>
                        </div>
                    </div>

                    {/* Tabla de cuentas */}
                    <div className="md:col-span-3 bg-zinc-900 p-4 rounded-lg border border-zinc-700 mt-0 md:mt-0 h-[70vh] overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-zinc-800 text-zinc-300 p-2">
                                <TableRow>
                                    {brokerAccountColumns.map((column) => (
                                        <TableHead key={column.accessorKey} className="text-zinc-300 border-b border-zinc-700">
                                            {column.header}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!data?.data || data.data.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={brokerAccountColumns.length} className="text-center text-zinc-500 py-6">
                                            No se encontraron resultados.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    data.data.map((account) => (
                                        <TableRow key={account.id} className="border-b border-zinc-700">
                                            {brokerAccountColumns.map((col) => (
                                                <TableCell key={col.accessorKey}>
                                                    {col.accessorKey === "used"
                                                        ? account[col.accessorKey] === false ? "No" : "Sí"
                                                        : account[col.accessorKey] ?? account.attributes?.[col.accessorKey] ?? "N/A"}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}