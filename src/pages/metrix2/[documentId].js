// src/pages/metrix2/[documentId].js
import React, { useEffect, useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "../../components/layout/dashboard";
import Loader from "../../components/loaders/loader";
import { PhoneIcon, ChartBarIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import CredencialesModal from "../dashboard/credentials";
import Link from "next/link";
import WinLoss from "./winloss";
import Statistics from './statistics';
import MyPage from "./grafico";
import Dashboard from "src/pages/metrix2/barrascircular";
import Objetivos from "./objetivos";
import RelatedChallenges from "../../components/challenges/RelatedChallenges";

/**
 * Fetcher simplificado para GET requests
 */
const fetcher = (url, token) =>
  fetch(url, {
    headers: {
      Authorization: `Bearer ${token || process.env.NEXT_PUBLIC_API_TOKEN}`,
    },
  }).then((res) => {
    if (!res.ok) {
      console.error(`Error en respuesta: ${res.status} ${res.statusText}`);
      throw new Error(`Error API: ${res.status}`);
    }
    return res.json();
  });

/**
 * Función para determinar el stage correcto basado en la fase actual y los stages disponibles
 */
const determineCorrectStage = (currentPhase, stages) => {
  if (!stages || !Array.isArray(stages) || stages.length === 0) {
    console.warn('No hay stages disponibles');
    return null;
  }

  const totalStages = stages.length;
  let stageIndex;

  // console.log(`Determinando stage: Fase actual=${currentPhase}, Total stages=${totalStages}`);

  // Si tenemos 2 o 3 stages totales, aplicamos la lógica inversa
  if (totalStages === 2 || totalStages === 3) {
    if (currentPhase === 2) {
      // Si la fase es 2 (con 2 fases totales), seleccionamos el primer stage (índice 0)
      stageIndex = 0;
      // console.log(`Caso especial: Fase 2 con ${totalStages} stages totales -> Seleccionando índice 0`);
    } else if (currentPhase === 3) {
      // Si la fase es 3 (con 1 fase total), seleccionamos el único stage
      stageIndex = 0;
      // console.log(`Caso especial: Fase 3 con ${totalStages} stages totales -> Seleccionando índice 0`);
    } else {
      // Para otras fases, calculamos el índice correspondiente sin pasarnos del total
      stageIndex = Math.min(currentPhase - 1, totalStages - 1);
      // console.log(`Caso normal con ${totalStages} stages: Calculando índice ${stageIndex} (min(${currentPhase}-1, ${totalStages}-1))`);
    }
  } else {
    // Para otros casos de cantidad de stages, simplemente usamos la fase actual - 1 como índice
    stageIndex = Math.min(currentPhase - 1, totalStages - 1);
    // console.log(`Caso estándar: Calculando índice ${stageIndex} (min(${currentPhase}-1, ${totalStages}-1))`);
  }

  // console.log(`Stage seleccionado con índice ${stageIndex}:`, stages[stageIndex]);
  return stages[stageIndex];
};

const Metrix = () => {
  const router = useRouter();
  const { documentId } = router.query;
  const { data: session } = useSession();

  // Estados para almacenar datos procesados
  const [metadataStats, setMetadataStats] = useState(null);
  const [currentStage, setCurrentStage] = useState(null);
  const [initialBalance, setInitialBalance] = useState(null);
  const [currentChallenge, setCurrentChallenge] = useState(null);
  const [challengeConfig, setChallengeConfig] = useState(null);

  // Estados para valores monetarios para la gráfica
  const [ddPercent, setDdPercent] = useState(10);       // fallback
  const [profitTargetPercent, setProfitTargetPercent] = useState(10); // fallback
  const [maxDrawdownAbsolute, setMaxDrawdownAbsolute] = useState(null);
  const [profitTargetAbsolute, setProfitTargetAbsolute] = useState(null);

  // Obtener datos básicos del usuario con sus challenges
  const { data: userData, error, isLoading } = useSWR(
    session?.jwt && documentId
      ? [
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/users/me?populate[challenges]=*`,
        session.jwt
      ]
      : null,
    ([url, token]) => {
      // console.log("Consultando URL:", url);
      return fetcher(url, token);
    }
  );

  // Encontrar el challenge específico y obtener sus detalles completos
  useEffect(() => {
    if (userData?.challenges && documentId && session?.jwt) {
      // Primero encontrar el challenge básico entre los challenges del usuario
      const basicChallenge = userData.challenges.find(
        (challenge) => challenge.documentId === documentId
      );

      if (basicChallenge && basicChallenge.id) {
        // console.log('Challenge básico encontrado:', basicChallenge);

        // Obtener detalles completos del challenge encontrado
        fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/challenges/${basicChallenge.documentId}?populate[broker_account]=*&populate[challenge_relation][populate][challenge_stages]=*`, {
          headers: {
            Authorization: `Bearer ${session.jwt}`,
          },
        })
          .then(res => {
            if (!res.ok) throw new Error(`Error API: ${res.status}`);
            return res.json();
          })
          .then(response => {
            const detailedChallenge = response.data || response;
            // console.log('Detalles completos del challenge:', detailedChallenge);

            // Extraer broker_account considerando diferentes estructuras posibles
            let brokerAccount = null;

            // Caso 1: broker_account directamente en detailedChallenge
            if (detailedChallenge.broker_account) {
              brokerAccount = detailedChallenge.broker_account;
            }
            // Caso 2: broker_account en attributes
            else if (detailedChallenge.attributes && detailedChallenge.attributes.broker_account) {
              brokerAccount = detailedChallenge.attributes.broker_account;
            }
            // Caso 3: broker_account con formato data/attributes
            else if (detailedChallenge.attributes &&
              detailedChallenge.attributes.broker_account &&
              detailedChallenge.attributes.broker_account.data) {
              brokerAccount = detailedChallenge.attributes.broker_account.data.attributes;
            }

            // console.log('Broker account extraído:', brokerAccount);

            // Combinar datos básicos con detalles y broker_account procesado
            setCurrentChallenge({
              ...basicChallenge,
              ...(detailedChallenge.attributes || detailedChallenge),
              broker_account: brokerAccount
            });
          })
          .catch(err => {
            console.error('Error al obtener detalles del challenge:', err);
            setCurrentChallenge(basicChallenge); // Usar datos básicos si falla
          });
      } else {
        console.warn('No se encontró challenge con documentId:', documentId);
        setCurrentChallenge(null);
      }
    }
  }, [userData, documentId, session?.jwt]);

  // Procesar los datos del challenge cuando se reciben
  useEffect(() => {
    // Verificar si hay un desafío actual seleccionado
    if (!currentChallenge) {
      // console.log('No hay desafío actual seleccionado aún');
      return;
    }

    // Console log para verificar los datos completos recibidos
    // console.log('Datos del challenge recibidos:', {
    //   documentId,
    //     phase: currentChallenge.phase,
    //       hasMetadata: !!currentChallenge.metadata,
    //         metadataType: typeof currentChallenge.metadata
    // });

    // Obtener el balance inicial del broker
    const brokerInitialBalance = currentChallenge.broker_account?.balance;
    // console.log("Balance inicial del broker_account:", brokerInitialBalance);
    setInitialBalance(brokerInitialBalance);

    // Procesar metadata si existe
    if (currentChallenge.metadata) {
      try {
        // Intentar parsear el JSON si es un string
        const metadata = typeof currentChallenge.metadata === 'string'
          ? JSON.parse(currentChallenge.metadata)
          : currentChallenge.metadata;

        // console.log('Metadata parseada correctamente:', metadata);

        // Extraer datos relevantes
        if (metadata && (metadata.metrics || metadata.trades)) {
          // Dar prioridad a metrics si existe, sino usar toda la metadata
          const statsToUse = { ...metadata.metrics || metadata };

          // Verificar si hay equityChart en metadata o en metrics
          if (metadata.equityChart) {
            // console.log("equityChart encontrado en metadata principal");
            statsToUse.equityChart = metadata.equityChart;
          } else if (metadata.metrics && metadata.metrics.equityChart) {
            // console.log("equityChart encontrado en metadata.metrics");
            statsToUse.equityChart = metadata.metrics.equityChart;
          }

          // Verificar si hay datos en equityChart
          if (statsToUse.equityChart) {
            // console.log("Datos de equityChart disponibles:", {
            //   length: Array.isArray(statsToUse.equityChart) ? statsToUse.equityChart.length : 'No es array',
            //     muestra: Array.isArray(statsToUse.equityChart) ? statsToUse.equityChart.slice(0, 2) : statsToUse.equityChart
            // });
          } else {
            console.warn("No se encontraron datos de equityChart");

            // Si no hay equityChart, intentar crear uno básico con datos disponibles
            if (statsToUse.balance && statsToUse.equity) {
              // console.log("Creando equityChart básico con balance y equity");
              statsToUse.equityChart = [
                {
                  timestamp: new Date().getTime() - 86400000, // Ayer
                  equity: brokerInitialBalance || 10000,
                  balance: brokerInitialBalance || 10000
                },
                {
                  timestamp: new Date().getTime(), // Hoy
                  equity: statsToUse.equity,
                  balance: statsToUse.balance
                }
              ];
            }
          }

          // Agregar propiedades adicionales
          statsToUse.broker_account = metadata.broker_account || currentChallenge.broker_account;
          statsToUse.initialBalance = brokerInitialBalance;

          // Si llega hasta aquí sin equityChart, intentamos darle un formato básico para que no falle
          if (!statsToUse.equityChart) {
            statsToUse.equityChart = [
              { timestamp: new Date().getTime() - 86400000, equity: brokerInitialBalance || 10000, balance: brokerInitialBalance || 10000 },
              { timestamp: new Date().getTime(), equity: brokerInitialBalance || 10000, balance: brokerInitialBalance || 10000 }
            ];
          }

          // Obtener la fase actual del challenge
          const challengePhase = currentChallenge.phase;

          // Obtener los stages disponibles de la metadata o de challenge_relation
          const stages = metadata.challenge_stages ||
            (currentChallenge.challenge_relation &&
              currentChallenge.challenge_relation.challenge_stages);

          // Aplicar la lógica para determinar el stage correcto
          const selectedStage = determineCorrectStage(challengePhase, stages);

          if (selectedStage) {
            // console.log('Stage seleccionado correctamente:', selectedStage);
            setCurrentStage(selectedStage);

            // Extraer parámetros importantes para los objetivos
            const maxLoss = selectedStage.maximumTotalLoss || 10;
            const profitTarget = selectedStage.profitTarget || 10;
            const maxDailyLoss = selectedStage.maximumDailyLoss || 5;
            const minTradingDays = selectedStage.minimumTradingDays || 0;

            // Guardar valores para maxDrawdown y profitTarget
            setDdPercent(maxLoss);
            setProfitTargetPercent(profitTarget);

            // Guardar configuración para el componente Objetivos
            setChallengeConfig({
              minimumTradingDays: minTradingDays,
              maximumDailyLossPercent: maxDailyLoss,
              maxDrawdownPercent: maxLoss,
              profitTargetPercent: profitTarget
            });

            // 1) Calcular maxDrawdownAbsolute en valor monetario (resta)
            if (brokerInitialBalance) {
              const ddAbsolute = brokerInitialBalance - (maxLoss / 100) * brokerInitialBalance;
              // console.log("maxDrawdown en valor monetario (resta):", ddAbsolute);
              setMaxDrawdownAbsolute(ddAbsolute);

              // 2) Calcular profitTargetAbsolute en valor monetario (suma)
              const ptAbsolute = brokerInitialBalance + (profitTarget / 100) * brokerInitialBalance;
              // console.log("profitTarget en valor monetario (suma):", ptAbsolute);
              setProfitTargetAbsolute(ptAbsolute);
            }
          }

          // Añadir valores calculados si faltan
          if (!statsToUse.maxDrawdown && (statsToUse.balance || statsToUse.equity) && brokerInitialBalance) {
            const currentBalance = statsToUse.balance || statsToUse.equity;
            const drawdownAmount = brokerInitialBalance - currentBalance;
            statsToUse.maxDrawdown = drawdownAmount > 0 ? drawdownAmount : 0;
            statsToUse.maxDrawdownPercent = (statsToUse.maxDrawdown / brokerInitialBalance) * 100;
          }

          if (!statsToUse.profit && statsToUse.balance && brokerInitialBalance) {
            statsToUse.profit = statsToUse.balance - brokerInitialBalance;
            statsToUse.profitPercent = (statsToUse.profit / brokerInitialBalance) * 100;
          }

          // Establecer las estadísticas
          // console.log("Estableciendo metadataStats con:", {
          // balance: statsToUse.balance,
          //     equity: statsToUse.equity,
          //       profit: statsToUse.profit,
          //         maxDrawdown: statsToUse.maxDrawdown,
          //           tieneEquityChart: !!statsToUse.equityChart,
          //             equityChartLength: statsToUse.equityChart ? statsToUse.equityChart.length : 0
          // });

          setMetadataStats(statsToUse);
        } else {
          console.warn('La metadata no contiene datos válidos de métricas');
          createBasicStats(currentChallenge, brokerInitialBalance);
        }
      } catch (parseError) {
        console.error('Error al parsear metadata:', parseError);
        createBasicStats(currentChallenge, brokerInitialBalance);
      }
    } else {
      console.warn('No se encontró el campo metadata en el challenge');
      createBasicStats(currentChallenge, brokerInitialBalance);
    }
  }, [currentChallenge]);

  // Función auxiliar para crear datos básicos cuando no hay metadata
  const createBasicStats = (challenge, brokerInitialBalance) => {
    if (brokerInitialBalance) {
      const basicStats = {
        balance: brokerInitialBalance,
        equity: brokerInitialBalance,
        profit: 0,
        profitPercent: 0,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
        broker_account: challenge.broker_account,
        initialBalance: brokerInitialBalance,
        equityChart: [
          { timestamp: new Date().getTime() - 86400000, equity: brokerInitialBalance, balance: brokerInitialBalance },
          { timestamp: new Date().getTime(), equity: brokerInitialBalance, balance: brokerInitialBalance }
        ]
      };

      setMetadataStats(basicStats);
    }

    // Si no hay metadata, intentamos obtener los parámetros básicos del stage al menos
    if (challenge.challenge_relation && challenge.challenge_relation.challenge_stages) {
      const stages = challenge.challenge_relation.challenge_stages;
      const selectedStage = determineCorrectStage(challenge.phase, stages);

      if (selectedStage) {
        setCurrentStage(selectedStage);

        // Extraer parámetros para los objetivos
        const maxLoss = selectedStage.maximumTotalLoss || 10;
        const profitTarget = selectedStage.profitTarget || 10;
        const maxDailyLoss = selectedStage.maximumDailyLoss || 5;
        const minTradingDays = selectedStage.minimumTradingDays || 0;

        setDdPercent(maxLoss);
        setProfitTargetPercent(profitTarget);

        setChallengeConfig({
          minimumTradingDays: minTradingDays,
          maximumDailyLossPercent: maxDailyLoss,
          maxDrawdownPercent: maxLoss,
          profitTargetPercent: profitTarget
        });

        if (brokerInitialBalance) {
          const ddAbsolute = brokerInitialBalance - (maxLoss / 100) * brokerInitialBalance;
          setMaxDrawdownAbsolute(ddAbsolute);

          const ptAbsolute = brokerInitialBalance + (profitTarget / 100) * brokerInitialBalance;
          setProfitTargetAbsolute(ptAbsolute);
        }
      }
    }
  };

  // Loading y Error
  if (isLoading || !session) {
    return (
      <Layout>
        <Loader />
      </Layout>
    );
  }

  if (error || !userData) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center text-white">
          <div className="p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-lg w-full">
            <h1 className="text-2xl font-bold text-red-600">🚧 Error de conexión 🚧</h1>
            <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
              No se pudieron cargar los datos. Por favor, intenta nuevamente más tarde.
            </p>
            {error && error.message && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 rounded text-sm text-red-800 dark:text-red-200">
                Error: {error.message}
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  // No challenge data
  if (!currentChallenge) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-20 text-center text-white">
          <div className="p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-lg w-full">
            <h1 className="text-2xl font-bold text-yellow-600">⚠️ Challenge no encontrado ⚠️</h1>
            <p className="mt-4 text-lg text-gray-700 dark:text-gray-300">
              No se encontró ningún challenge con el ID proporcionado en tu cuenta.
              Verifica que el ID sea correcto y que tengas acceso a este challenge.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="flex p-6 pl-12 dark:bg-zinc-800 bg-white shadow-md rounded-lg dark:text-white dark:border-zinc-700 dark:shadow-black">
        <ChartBarIcon className="w-6 h-6 mr-2 text-gray-700 dark:text-white" />
        Account Metrix {currentChallenge?.broker_account?.login || "Sin nombre"}
      </h1>

      <div className="flex justify-start gap-3 my-6">
        {currentChallenge?.broker_account && <CredencialesModal {...currentChallenge.broker_account} />}

        <Link
          href="/support"
          className="flex items-center justify-center space-x-2 px-4 py-2 border rounded-lg shadow-md bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 border-gray-300 dark:border-zinc-500"
        >
          <PhoneIcon className="h-6 w-6 text-gray-600 dark:text-gray-200" />
          <span className="text-xs lg:text-sm dark:text-zinc-200">Contacte con nosotros</span>
        </Link>
        <button
          onClick={() => router.reload()}
          className="flex items-center justify-center space-x-2 px-4 py-2 border rounded-lg shadow-md bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 border-gray-300 dark:border-zinc-500"
        >
          <ArrowPathIcon className="h-6 w-6 text-gray-600 dark:text-gray-200" />
          <span className="text-xs lg:text-sm dark:text-zinc-200">Actualizar</span>
        </button>
      </div>

      {/* Componente de Barras Circulares */}
      <Dashboard
        // Balance inicial
        brokerInitialBalance={initialBalance}
        // maxDrawdown permitido (porcentaje)
        maxAllowedDrawdownPercent={ddPercent}
        // profitTarget (porcentaje)
        profitTargetPercent={profitTargetPercent}
        // métricas reales (balance actual, maxDrawdown real, etc.)
        metricsData={metadataStats}
      />

      {/* Gráfica de líneas */}
      <div className="mt-6">
        <MyPage
          statisticsData={metadataStats?.equityChart || []}
          maxDrawdownAbsolute={maxDrawdownAbsolute || (initialBalance ? initialBalance * 0.9 : 9000)}
          profitTargetAbsolute={profitTargetAbsolute || (initialBalance ? initialBalance * 1.1 : 11000)}
        />
      </div>

      {/* Componente de WinLoss */}
      <WinLoss data={metadataStats || {}} />

      {/* Objetivos */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold pb-4">Objetivo</h2>
        {challengeConfig ? (
          <Objetivos
            // Pasar la configuración del desafío
            challengeConfig={challengeConfig}
            // Pasar los datos de métricas reales
            metricsData={metadataStats}
            // Balance inicial para cálculos
            initBalance={initialBalance}
            // Fase actual
            pase={currentChallenge?.phase}
          />
        ) : (
          <div className="border-gray-500 dark:border-zinc-800 dark:shadow-black bg-white rounded-md shadow-md dark:bg-zinc-800 dark:text-white p-6 text-center">
            <p>Cargando objetivos...</p>
          </div>
        )}
      </div>

      {/* Estadísticas */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="w-full md:w-1/1 rounded-lg">
          <h2 className="text-lg font-bold mb-4 pt-5">Estadísticas</h2>
          <Statistics
            data={{
              ...metadataStats,
              phase: currentChallenge?.phase || "Desconocida",
              brokerInitialBalance: initialBalance // Pasar el balance inicial
            }}
          />
        </div>
      </div>

      {/* Componente para mostrar los challenges relacionados */}
      {userData?.challenges && (
        <RelatedChallenges
          currentChallenge={currentChallenge}
          userChallenges={userData.challenges}
        />
      )}
    </Layout>
  );
};

export default Metrix;