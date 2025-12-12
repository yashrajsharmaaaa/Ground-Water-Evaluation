function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function summarizeLocalForChat(
  localData = {},
  lat,
  lon,
  district,
  isLowest = false,
  year = null
) {

  const summary = {
    source: "local",
    stationsReturned: localData.data ? localData.data.length : 0,
    district: localData.district || district || null,
  };

  if (localData.data) {
    const arr = localData.data
      .filter(
        (s) =>
          s.latitude &&
          s.longitude &&
          s.history?.length > 0 &&
          s.history.some((h) => h.value > 0)
      )
      .map((s) => ({
        code: s.stationCode,
        name: s.stationName,
        latitude: s.latitude,
        longitude: s.longitude,
        history: s.history || [],
        distanceKm:
          lat && lon ? haversine(lat, lon, s.latitude, s.longitude) : null,
      }));
    if (year) {
      const monthlyData = {};
      arr.forEach((st) => {
        st.history.forEach((h) => {
          if (h.date && h.date.startsWith(year)) {
            const month = h.date.slice(0, 7);
            if (!monthlyData[month]) {
              monthlyData[month] = { total: 0, count: 0, stations: new Set() };
            }
            monthlyData[month].total += h.value;
            monthlyData[month].count += 1;
            monthlyData[month].stations.add(st.name);
          }
        });
      });
      const monthlyAverages = Object.entries(monthlyData).map(
        ([month, data]) => ({
          month,
          average: data.total / data.count,
          stations: Array.from(data.stations),
        })
      );
      monthlyAverages.sort((a, b) =>
        isLowest ? a.average - b.average : b.average - a.average
      );
      if (monthlyAverages.length > 0) {
        const target = monthlyAverages[0];
        summary.targetStation = {
          month: target.month,
          averageWaterLevel: target.average.toFixed(2),
          stations: target.stations,
          note: `Average ${
            isLowest ? "lowest" : "highest"
          } water level for ${year}`,
        };
      }
    } else {
      arr.sort((a, b) => {
        const aLatest = a.history[a.history.length - 1]?.value ?? -Infinity;
        const bLatest = b.history[b.history.length - 1]?.value ?? -Infinity;
        return isLowest ? aLatest - bLatest : bLatest - aLatest;
      });
      if (arr.length > 0) {
        const target = arr[0];
        const latest = target.history[target.history.length - 1];
        summary.targetStation = {
          stationName: target.name,
          stationCode: target.code,
          latitude: target.latitude,
          longitude: target.longitude,
          distanceKm: target.distanceKm ? target.distanceKm.toFixed(2) : null,
          latestDate: latest ? latest.date : null,
          targetWaterLevel:
            latest && !isNaN(latest.value) ? latest.value.toFixed(2) : null,
        };
      }
    }
  }
  return summary;
}


export function summarizeContextForChat(context, year, isLowest = false) {

  const summary = {
    source: "context",
    stationsReturned: context.nearestStation ? 1 : 0,
    district:
      getDistrictFromCoords(
        context.userLocation?.lat,
        context.userLocation?.lon
      ) || null,
  };

  if (context.historicalLevels && year) {
    const monthlyData = {};
    context.historicalLevels.forEach((h) => {
      if (h.date && h.date.startsWith(year)) {
        const month = h.date.slice(0, 7);
        if (!monthlyData[month]) {
          monthlyData[month] = { total: 0, count: 0 };
        }
        monthlyData[month].total += h.waterLevel;
        monthlyData[month].count += 1;
      }
    });
    const monthlyAverages = Object.entries(monthlyData).map(
      ([month, data]) => ({
        month,
        average: data.total / data.count,
      })
    );
    monthlyAverages.sort((a, b) =>
      isLowest ? a.average - b.average : b.average - a.average
    );
    if (monthlyAverages.length > 0) {
      const target = monthlyAverages[0];
      summary.targetStation = {
        month: target.month,
        averageWaterLevel: target.average.toFixed(2),
        stationName: context.nearestStation?.stationName || "Unknown",
        note: `Average ${
          isLowest ? "lowest" : "highest"
        } water level for ${year} from context`,
      };
    }
  } else if (context.nearestStation && context.currentWaterLevel) {
    summary.targetStation = {
      stationName: context.nearestStation.stationName,
      latitude: context.nearestStation.latitude,
      longitude: context.nearestStation.longitude,
      distanceKm: context.nearestStation.distanceKm,
      latestDate: context.userLocation?.date || null,
      targetWaterLevel:
        parseFloat(context.currentWaterLevel)?.toFixed(2) || null,
      note: `Current ${
        isLowest ? "lowest" : "highest"
      } water level from context`,
    };
  }
  return summary;
}

export 
function summarizeWrisForChat(
  wrisData = {},
  lat,
  lon,
  district,
  isLowest = false,
  year = null
) {

  const summary = {
    source: "wris",
    stationsReturned: wrisData.data ? wrisData.data.length : 0,
    district: wrisData.districtName || district || null,
  };

  if (wrisData.data) {
    const stations = new Map();
    for (const s of wrisData.data) {
      const code = s.stationCode || s.stationcode || s.station_code;
      const latS = parseFloat(s.latitude ?? s.lat ?? s.Latitude ?? NaN);
      const lonS = parseFloat(s.longitude ?? s.lon ?? s.Longitude ?? NaN);
      const level = parseFloat(s.dataValue ?? s.waterLevel ?? NaN);
      const t = s.dataTime || s.DataTime || s.timestamp || null;
      if (!code || isNaN(latS) || isNaN(lonS) || isNaN(level) || level <= 0)
        continue;
      if (!stations.has(code)) {
        stations.set(code, {
          code,
          name: s.stationName || s.stationname || "Unknown",
          latitude: latS,
          longitude: lonS,
          history: [],
          distanceKm: lat && lon ? haversine(lat, lon, latS, lonS) : null,
        });
      }
      stations
        .get(code)
        .history.push({ date: t ? t.split("T")[0] : null, value: level });
    }

    const arr = Array.from(stations.values()).filter(
      (st) => st.history.length > 0
    );
    if (arr.length > 0) {
      arr.forEach((st) => {
        st.history.sort((a, b) => new Date(a.date) - new Date(b.date));
      });
      if (year) {
        // Aggregate by month for the specified year
        const monthlyData = {};
        arr.forEach((st) => {
          st.history.forEach((h) => {
            if (h.date && h.date.startsWith(year)) {
              const month = h.date.slice(0, 7); // YYYY-MM
              if (!monthlyData[month]) {
                monthlyData[month] = {
                  total: 0,
                  count: 0,
                  stations: new Set(),
                };
              }
              monthlyData[month].total += h.value;
              monthlyData[month].count += 1;
              monthlyData[month].stations.add(st.name);
            }
          });
        });
        const monthlyAverages = Object.entries(monthlyData).map(
          ([month, data]) => ({
            month,
            average: data.total / data.count,
            stations: Array.from(data.stations),
          })
        );
        monthlyAverages.sort((a, b) =>
          isLowest ? a.average - b.average : b.average - a.average
        );
        if (monthlyAverages.length > 0) {
          const target = monthlyAverages[0];
          summary.targetStation = {
            month: target.month,
            averageWaterLevel: target.average.toFixed(2),
            stations: target.stations,
            note: `Average ${
              isLowest ? "lowest" : "highest"
            } water level for ${year}`,
          };
        }
      } else {
        arr.sort((a, b) => {
          const aLatest = a.history[a.history.length - 1]?.value ?? -Infinity;
          const bLatest = b.history[a.history.length - 1]?.value ?? -Infinity;
          return isLowest ? aLatest - bLatest : bLatest - aLatest;
        });
        const target = arr[0];
        const latest = target.history[target.history.length - 1];
        summary.targetStation = {
          stationName: target.name,
          stationCode: target.code,
          latitude: target.latitude,
          longitude: target.longitude,
          distanceKm: target.distanceKm ? target.distanceKm.toFixed(2) : null,
          latestDate: latest ? latest.date : null,
          targetWaterLevel:
            latest && !isNaN(latest.value) ? latest.value.toFixed(2) : null,
          note: `This is a lightweight summary derived from WRIS raw rows for ${
            isLowest ? "lowest" : "highest"
          } water level.`,
        };
      }
      summary.totalStationsWithHistory = arr.length;
    }
  }
  return summary;
}
