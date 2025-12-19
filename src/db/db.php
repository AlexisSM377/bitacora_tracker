<?php
// db.php para Hostinger
// Nota: evita imprimir credenciales/errores directamente; los endpoints deben manejar la excepción.
error_reporting(0);
ini_set('display_errors', 0);
mysqli_report(MYSQLI_REPORT_OFF);

// Posibles configuraciones para Hostinger
$configs = [
    // Configuración estándar
    [
        'host' => 'srv1145.hstgr.io',
        'port' => 3306,
        'user' => 'u558294948_test',
        'pass' => '=L~enk:7gH',
        'db'   => 'u558294948_test'
    ],
    // Alternativa (a veces host es diferente)
    [
        'host' => 'srv1145.hstgr.io',
        'port' => 3306,
        'user' => 'u558294948_test',
        'pass' => '=L~enk:7gH',
        'db'   => 'u558294948_test'
    ]
];

$conn = null;
$last_error = '';

foreach ($configs as $config) {
    // Firma: new mysqli(host, username, password, database, port)
    $conn = @new mysqli(
        $config['host'],
        $config['user'],
        $config['pass'],
        $config['db'],
        intval($config['port'] ?? 3306)
    );

    if (!$conn->connect_error) {
        // Conexión exitosa
        $conn->set_charset("utf8mb4");
        break;
    }
    
    $last_error = $conn->connect_error;
    $conn = null;
}

if (!$conn) {
    throw new Exception('No se pudo conectar a ninguna configuración. Último error: ' . $last_error);
}
?>